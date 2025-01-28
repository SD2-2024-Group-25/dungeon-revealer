import * as React from "react";

type ShowFileDialogFunction = () => void;
type OnSelectFilesFunction = (files: File[]) => void;

export const useSelectFolderDialog = (
  onSelect: OnSelectFilesFunction
): [React.ReactNode, ShowFileDialogFunction] => {
  const ref = React.useRef<HTMLInputElement>(null);
  const onChange = React.useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(ev.currentTarget.files || []);
      ev.currentTarget.value = "";
      const jsonFile = files.find((file) => file.name.endsWith(".json"));
      const pngFiles = files.filter((file) => file.name.endsWith(".png"));

      if (jsonFile && pngFiles.length === 3) {
        onSelect([jsonFile, ...pngFiles]);
      } else {
        console.error(
          "Please select one .json file and three .png files." //Makes sure correct files are inputted, may add modal/error popup for this
        );
      }
    },
    [onSelect]
  );

  const node = React.useMemo(
    () => (
      <input
        type="file"
        multiple
        accept=".jpeg,.jpg,.svg,.png"
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
