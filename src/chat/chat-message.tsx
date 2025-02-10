import React from "react";
import { createFragmentContainer } from "react-relay";
import graphql from "babel-plugin-relay/macro";
import styled from "@emotion/styled/macro";
import MarkdownView from "react-showdown";
import _sanitizeHtml from "sanitize-html";
import { useFragment } from "relay-hooks";
import {
  HStack,
  IconButton,
  Popover,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Portal,
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Code,
} from "@chakra-ui/react";
import { useNoteWindowActions } from "../dm-area/token-info-aside";
import { SharableImage } from "../dm-area/components/sharable-image";
import * as Icon from "../feather-icons";
import * as Button from "../button";
import { chatMessageComponents } from "../user-content-components";
import type { chatMessage_message } from "./__generated__/chatMessage_message.graphql";
import { chatMessage_SharedResourceChatMessageFragment$key } from "./__generated__/chatMessage_SharedResourceChatMessageFragment.graphql";
import { DiceRoll, FormattedDiceRoll } from "./formatted-dice-roll";

function linkifyRoomUrls(rawText: string) {
  return rawText.replace(
    /(^|\s)((https?:\/\/)?[^\s]+?#room=[^\s]+)/g,
    (_match, prefix, url) => {
      let finalUrl = url;
      // If no scheme, add "http://"
      if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
        finalUrl = "http://" + finalUrl;
      }
      return `${prefix}[${url}](${finalUrl})`;
    }
  );
}

function convertRoomHashToLink(rawText: string): string {
  return rawText.replace(
    /(#room=[^\s]+)/g, // <--- removed (^|\s)
    (fullMatch) => {
      const roomRef = fullMatch; // e.g. "#room=abcdef"
      const link = `http://localhost:5000/${roomRef}`;
      // or do "[http://localhost:5000/#room=abc](http://localhost:5000/#room=abc)"
      return `[${roomRef}](${link})`;
    }
  );
}
const Container = styled.div`
  padding-bottom: 4px;
  > * {
    line-height: 24px;
  }
  /* Force anchor tags to be blue */
  a {
    color: blue !important;
  }
`;

const AuthorName = styled.div`
  display: block;
  font-weight: bold;
`;

type ReactComponent = (props: any) => React.ReactElement | null;

const { sanitizeHtml, components } = (() => {
  // 1) Add "a" to allowedTags
  const allowedTags = [
    "div",
    "blockquote",
    "span",
    "em",
    "strong",
    "pre",
    "code",
    "img",
    "FormattedDiceRoll",
    "a",
  ];

  // 2) Add relevant attributes for "a" to allowedAttributes
  const allowedAttributes: Record<string, Array<string>> = {
    span: ["style"],
    div: ["style"],
    img: ["src"],
    a: ["href", "target", "title", "rel"],
    FormattedDiceRoll: ["index", "reference"],
  };

  // Step A: create an empty 'components' object
  const components: Record<string, ReactComponent> = {};

  // Step B: populate from chatMessageComponents
  for (const [name, config] of Object.entries(chatMessageComponents)) {
    if (typeof config === "function") {
      allowedTags.push(name);
      components[name] = config;
      continue;
    }
    if (typeof config === "object") {
      if (config.allowedAttributes != null) {
        allowedAttributes[name] = config.allowedAttributes;
        allowedTags.push(name);
        components[name] = config.Component;
      }
    }
  }

  // Step C: define your CustomLink
  const CustomLink: ReactComponent = ({ href, children, ...rest }) => {
    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (href?.includes("#room=")) {
        event.preventDefault();
        // Instead of letting normal navigation happen, send the link to the parent
        window.parent.postMessage(
          {
            type: "OPEN_EXCALIDRAW",
            payload: {
              href,
            },
          },
          "*"
        );
      }
    };

    return (
      <a href={href} onClick={handleClick} {...rest}>
        {children}
      </a>
    );
  };

  // Step D: register the custom link
  components.a = CustomLink;

  // Step E: define sanitizeHtml
  const sanitizeHtml = (html: string) =>
    _sanitizeHtml(html, {
      allowedTags,
      allowedAttributes,
      transformTags: {
        // Convert <p> to <div>
        p: "div",
      },
      selfClosing: ["FormattedDiceRoll"],
      parser: {
        lowerCaseTags: false,
      },
    });

  // Step F: return them
  return { sanitizeHtml, components };
})();

// A simple text renderer for operational messages, *with* linkify options
const TextRenderer: React.FC<{ text: string }> = ({ text }) => {
  return (
    <MarkdownView
      markdown={text}
      sanitizeHtml={sanitizeHtml}
      // 3) Add showdown options that auto-link URLs
      options={{
        simplifiedAutoLink: true,
        openLinksInNewTab: true,
        literalMidWordUnderscores: true,
        simpleLineBreaks: true,
      }}
    />
  );
};

type DiceRollResultArray = Extract<
  chatMessage_message,
  { __typename: "UserChatMessage" }
>["diceRolls"];

export type DiceRollType = DiceRollResultArray[number];

type DiceRollResultContextValue = {
  diceRolls: DiceRollResultArray;
  referencedDiceRolls: DiceRollResultArray;
};

export const DiceRollResultContext =
  React.createContext<DiceRollResultContextValue>(
    // TODO: Use context that throws by default
    undefined as any
  );

const UserMessageRenderer = ({
  authorName,
  content,
  diceRolls,
  referencedDiceRolls,
}: {
  authorName: string;
  content: string;
  diceRolls: DiceRollResultArray;
  referencedDiceRolls: DiceRollResultArray;
}) => {
  // Step A: Insert <FormattedDiceRoll> for dice placeholders
  const replacedDiceContent = React.useMemo(
    () =>
      content.replace(
        /{(r)?(\d*)}/g,
        (_, isReferenced, index) =>
          `<FormattedDiceRoll index="${index}"${
            isReferenced ? ` reference="yes"` : ``
          } />`
      ),
    [content]
  );

  // Step B: Transform "#room=..." text into Markdown links
  const finalContent = React.useMemo(
    () => convertRoomHashToLink(replacedDiceContent),
    [replacedDiceContent]
  );

  return (
    <DiceRollResultContext.Provider value={{ diceRolls, referencedDiceRolls }}>
      <Container>
        <HStack justifyContent="space-between">
          <AuthorName>{authorName}: </AuthorName>
          {diceRolls.length || referencedDiceRolls.length ? (
            <Popover placement="left">
              <PopoverTrigger>
                <IconButton
                  aria-label="Show Info"
                  icon={<Icon.Info />}
                  size="sm"
                  variant="unstyled"
                />
              </PopoverTrigger>
              <Portal>
                <PopoverContent>
                  <PopoverHeader>Dice Rolls</PopoverHeader>
                  <PopoverCloseButton />
                  <PopoverBody>
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th>ID</Th>
                          <Th>Result</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {[...diceRolls, ...referencedDiceRolls].map((roll) => (
                          <Tr key={roll.rollId}>
                            <Td>
                              <Code>{roll.rollId}</Code>
                            </Td>
                            <Td>
                              <DiceRoll diceRoll={roll} />
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </PopoverBody>
                </PopoverContent>
              </Portal>
            </Popover>
          ) : null}
        </HStack>

        {/* Finally render the combined text in MarkdownView */}
        <MarkdownView
          markdown={finalContent}
          components={{ ...components, FormattedDiceRoll }}
          sanitizeHtml={sanitizeHtml}
          options={{
            simplifiedAutoLink: true,
            openLinksInNewTab: false,
            simpleLineBreaks: true,
          }}
        />
      </Container>
    </DiceRollResultContext.Provider>
  );
};

const ChatMessage_SharedResourceChatMessageFragment = graphql`
  fragment chatMessage_SharedResourceChatMessageFragment on SharedResourceChatMessage {
    __typename
    authorName
    resource {
      ... on Note {
        __typename
        id
        documentId
        title
        contentPreview
      }
      ... on Image {
        __typename
        id
        imageId
      }
    }
  }
`;

const NoteCard = styled.div`
  border: 0.5px solid lightgrey;
  border-radius: 2px;
`;

const NoteTitle = styled.div`
  font-weight: bold;
  padding: 8px;
  padding-bottom: 4px;
`;

const NoteBody = styled.div`
  padding: 8px;
  padding-top: 0;
`;

const NoteFooter = styled.div`
  padding: 8px;
`;

const NotePreview: React.FC<{
  documentId: string;
  title: string;
  contentPreview: string;
}> = ({ documentId, title, contentPreview }) => {
  const noteWindowActions = useNoteWindowActions();
  return (
    <NoteCard>
      <NoteTitle>{title}</NoteTitle>
      <NoteBody>{contentPreview}</NoteBody>
      <NoteFooter>
        <Button.Primary
          small
          onClick={() =>
            noteWindowActions.focusOrShowNoteInNewWindow(documentId)
          }
        >
          Show
        </Button.Primary>
      </NoteFooter>
    </NoteCard>
  );
};

const SharedResourceRenderer: React.FC<{
  message: chatMessage_SharedResourceChatMessageFragment$key;
}> = ({ message: messageKey }) => {
  const message = useFragment(
    ChatMessage_SharedResourceChatMessageFragment,
    messageKey
  );

  let resourceContent: React.ReactNode = <strong>CONTENT UNAVAILABLE</strong>;

  if (message.resource) {
    switch (message.resource.__typename) {
      case "Note":
        resourceContent = (
          <NotePreview
            documentId={message.resource.documentId}
            title={message.resource.title}
            contentPreview={message.resource.contentPreview}
          />
        );
        break;
      case "Image":
        resourceContent = <SharableImage id={message.resource.imageId} />;
    }
  }

  return (
    <Container>
      <AuthorName>{message.authorName} shared </AuthorName>
      {resourceContent}
    </Container>
  );
};

const ChatMessageRenderer: React.FC<{
  message: chatMessage_message;
}> = React.memo(({ message }) => {
  switch (message.__typename) {
    case "UserChatMessage":
      return (
        <UserMessageRenderer
          authorName={message.authorName}
          content={message.content}
          diceRolls={message.diceRolls}
          referencedDiceRolls={message.referencedDiceRolls}
        />
      );
    case "OperationalChatMessage":
      return (
        <Container>
          {/* Renders an operational message (like system notifications) */}
          <TextRenderer text={message.content} />
        </Container>
      );
    case "SharedResourceChatMessage":
      return <SharedResourceRenderer message={message} />;
    default:
      return null;
  }
});

export const ChatMessage = createFragmentContainer(ChatMessageRenderer, {
  message: graphql`
    fragment chatMessage_message on ChatMessage {
      ... on UserChatMessage {
        __typename
        authorName
        content
        diceRolls {
          rollId
          result
          detail {
            ... on DiceRollOperatorNode {
              __typename
              content
            }
            ... on DiceRollConstantNode {
              __typename
              content
            }
            ... on DiceRollOpenParenNode {
              __typename
              content
            }
            ... on DiceRollCloseParenNode {
              __typename
              content
            }
            ... on DiceRollDiceRollNode {
              __typename
              content
              rollResults {
                dice
                result
                category
                crossedOut
              }
            }
          }
        }
        referencedDiceRolls {
          rollId
          result
          detail {
            ... on DiceRollOperatorNode {
              __typename
              content
            }
            ... on DiceRollConstantNode {
              __typename
              content
            }
            ... on DiceRollOpenParenNode {
              __typename
              content
            }
            ... on DiceRollCloseParenNode {
              __typename
              content
            }
            ... on DiceRollDiceRollNode {
              __typename
              content
              rollResults {
                dice
                result
                category
                crossedOut
              }
            }
          }
        }
      }
      ... on OperationalChatMessage {
        __typename
        content
      }
      ... on SharedResourceChatMessage {
        __typename
        ...chatMessage_SharedResourceChatMessageFragment
      }
    }
  `,
});
