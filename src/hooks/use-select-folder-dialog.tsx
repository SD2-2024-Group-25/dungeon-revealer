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

      const imageExtensions = [".png", ".jpg", ".jpeg", ".svg"];
      const imageFiles = files.filter((file) =>
        imageExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
      );

      if (jsonFile && imageFiles.length === 3) {
        // Process the files
        const jsonText = await jsonFile.text();
        const jsonData = JSON.parse(jsonText);

        const modifyJson = (newTitle: string): File => {
          // Modify the JSON title
          jsonData.title = newTitle;
          jsonData.id = newTitle;
          return new File([JSON.stringify(jsonData, null, 2)], jsonFile.name, {
            type: "application/json",
          });
        };

        onSelect([jsonFile, ...imageFiles], folderNameRef.current, modifyJson);
      } else {
        console.error(
          "Please select one .json file and three image files (png, jpg, jpeg, gif, webp)."
        );
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
        accept=".json,.png,.jpg,.gif,.jpeg,.webp,.svg"
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
