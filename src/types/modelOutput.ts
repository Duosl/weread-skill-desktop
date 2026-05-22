export type ModelOutputBlock = {
  kind: "thinking" | "output" | "system" | "error";
  title: string;
  text: string;
};

export type ModelOutputMode = "brief" | "detail";
