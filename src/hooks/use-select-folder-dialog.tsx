import * as React from "react";
//import { generateSHA256FileHash } from "../crypto";

type ShowFileDialogFunction = () => void;
//type OnSelectFilesFunction = (files: File[]) => void;

export const useSelectFolderDialog = (
  onSelect: (
    files: File[],
    extractedFolderName: string,
    modifyJson: (title: string) => File
  ) => void
): [React.ReactNode, ShowFileDialogFunction] => {
  const ref = React.useRef<HTMLInputElement>(null);
  const folderNameRef = React.useRef<string>("");

  const onChange = React.useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(ev.currentTarget.files || []);
      ev.currentTarget.value = "";

      const jsonFile = files.find((file) => file.name.endsWith(".json"));
      const pngFiles = files.filter((file) => file.name.endsWith(".png"));

      if (jsonFile && pngFiles.length === 3) {
        let jsonText = await jsonFile.text();
        let jsonData = JSON.parse(jsonText);

        folderNameRef.current = jsonData.title;

        const modifyJson = (newTitle: string): File => {
          jsonData.title = newTitle;
          jsonData.id = newTitle;
          folderNameRef.current = newTitle;
          return new File([JSON.stringify(jsonData, null, 2)], jsonFile.name, {
            type: "application/json",
          });
        };

        onSelect([jsonFile, ...pngFiles], folderNameRef.current, modifyJson);
      } else {
        console.error("Please select one .json file and three image files.");
      }
    },
    [onSelect]
  );

  const node = React.useMemo(
    //File types
    () => (
      <input
        type="file"
        multiple
        accept=".json,.png,.jpg,.jpeg"
        ref={ref}
        onChange={onChange}
        style={{ display: "none" }}
      />
    ),
    [onChange]
  );

  const showFilesDialog = React.useCallback(() => {
    ref.current?.click();
  }, []);

  return [node, showFilesDialog];
};
