declare module "magic-string" {
  export interface BundleOptions {
    intro?: string;
    separator?: string;
  }

  export interface SourceMapOptions {
    hires: boolean;
    file: string;
    sources: string[];
    sourcesContent: string;
    includeContent: boolean;
    names: string[];
    mappings: string[];
  }

  class SourceMap {
    constructor(properties: SourceMapOptions);
    toString(): string;
    toUrl(): string;
  }

  class Bundle {
    constructor(options?: BundleOptions);
    addSource(source: MagicString | { filename?: string, content: MagicString }): Bundle;
    append(str: string, options: BundleOptions): Bundle;
    clone(): Bundle;
    generateMap(options?: Partial<SourceMapOptions>): SourceMap;
    getIndentString(): string;
    indent(indentStr: string): Bundle;
    prepend(str: string): Bundle;
    toString(): string;
    trimLines(): string;
    trim(charType: string): string;
    trimStart(charType: string): Bundle;
    trimEnd(charType: string): Bundle;
  }

  export interface MagicStringOptions {
    filename: string,
    indentExclusionRanges: any; // TODO
  }

  export interface IndentOptions {
    exclude: any; // TODO
    indentStart: boolean;
  }

  export interface OverwriteOptions {
    storeName: boolean;
    contentOnly: boolean;
  }

  class MagicString {
    constructor(str: string, options?: MagicStringOptions);
    addSourcemapLocation(char: number): void;
    append(content: string): MagicString;
    appendLeft(index: number, content: string): MagicString;
    appendRight(index: number, content: string): MagicString;
    clone(): MagicString;
    generateMap(options?: Partial<SourceMapOptions>);
    getIndentString(): string;

    indent(options?): MagicString;
    indent(indentStr: string, options: IndentOptions): MagicString;

    move(start: number, end: number, index: number): MagicString;
    overwrite(start: number, end: number, content: string, options?: boolean | OverwriteOptions): MagicString;
    prepend(content: string): MagicString;
    prependLeft(index: number, content: string): MagicString;
    prependRight(index: number, content: string): MagicString;
    remove(start: number, end: number): MagicString;
    slice(start: number, end: number): string;
    snip(start: number, end: number): MagicString;
    
    static Bundle: Bundle;
  }

  export = MagicString;
}
