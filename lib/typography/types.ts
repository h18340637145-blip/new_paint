export type ThemeId =
  | "minimal-reading"
  | "deep-column"
  | "tech-product"
  | "visual-story"
  | "brand-release";

export type HeadingStyleKind =
  | "plain"
  | "bar"
  | "numbered"
  | "band"
  | "underline"
  | "pill"
  | "corner-tl"
  | "corner-bl";

export type UnorderedListStyle = "disc" | "square" | "dash" | "check";
export type OrderedListStyle = "decimal" | "leading-zero";
export type ImageStyleKind = "full" | "padded" | "rounded" | "bordered";
export type DividerStyleKind = "solid" | "dashed" | "short" | "dots" | "blank";

export interface ColorPalette {
  id: string;
  name: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  quoteBgColor: string;
}

export interface HeadingStyleConfig {
  style: HeadingStyleKind;
  fontSize: number;
  fontWeight: 400 | 600 | 700;
  align: "left" | "center";
  marginTop: number;
  marginBottom: number;
}

export interface ParagraphStyleConfig {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  marginTop: number;
  marginBottom: number;
  textAlign: "justify" | "left";
}

export interface ListStyleConfig {
  unorderedStyle: UnorderedListStyle;
  orderedStyle: OrderedListStyle;
  indent: number;
  itemSpacing: number;
}

export interface ImageStyleConfig {
  style: ImageStyleKind;
  align: "left" | "center" | "right";
  maxWidth: number;
  borderRadius: number;
  spacing: number;
}

export interface DividerStyleConfig {
  style: DividerStyleKind;
  widthPercent: number;
  color: string;
  spacing: number;
}

export interface TemplateStyleConfig {
  paletteId: string;
  colors: Omit<ColorPalette, "id" | "name">;
  heading: HeadingStyleConfig;
  paragraph: ParagraphStyleConfig;
  list: ListStyleConfig;
  image: ImageStyleConfig;
  divider: DividerStyleConfig;
}

export interface TypographySubTemplate {
  id: string;
  themeId: ThemeId;
  name: string;
  description: string;
  sourceArticleTitle?: string;
  sourceArticleUrl?: string;
  defaultStyle: TemplateStyleConfig;
  sampleMarkdown: string;
}

export interface TypographyTheme {
  id: ThemeId;
  name: string;
  summary: string;
  palettes: ColorPalette[];
}

import type { AppliedComponentSnapshot } from "./custom-tree";

export interface AppliedLibraryTemplateMeta {
  itemId: string | null;
  name: string;
  version: number;
  style: TemplateStyleConfig;
  sampleMarkdown: string;
}

export interface TypographyPersistedState {
  version: 2;
  activeSubTemplateId: string;
  content: string;
  hasEditedContent: boolean;
  styleOverrides: Record<string, TemplateStyleConfig>;
  drafts: Record<string, string>;
  appliedSnapshots?: Record<string, AppliedComponentSnapshot>;
  activeLibraryTemplate?: AppliedLibraryTemplateMeta | null;
}
