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

  const onChange = React.useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(ev.currentTarget.files || []);
      ev.currentTarget.value = "";

      const jsonFile = files.find((file) => file.name.endsWith(".json"));
      const pngFiles = files.filter((file) => file.name.endsWith(".png"));

      if (jsonFile && pngFiles.length === 3) {
        //Makes sure correct files are inputted, may add modal/error popup for this
        const jsonText = await jsonFile.text();
        const jsonData = JSON.parse(jsonText);

        const folderName = jsonData.id;
        const modifyJson = (newTitle: string): File => {
          //Changes title
          jsonData.title = newTitle;
          return new File([JSON.stringify(jsonData, null, 2)], jsonFile.name, {
            type: "application/json",
          });
        };

        onSelect([jsonFile, ...pngFiles], folderName, modifyJson);
      } else {
        console.error("Please select one .json file and three .png files.");
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
        accept=".json,.png"
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
