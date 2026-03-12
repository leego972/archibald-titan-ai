/**
 * Ambient type declarations for modules that are used at runtime
 * but whose @types packages have peer-dependency conflicts.
 * These stubs satisfy the TypeScript compiler without installing the packages.
 */

declare module "jszip" {
  interface JSZipObject {
    name: string;
    async(type: "string"): Promise<string>;
    async(type: "uint8array"): Promise<Uint8Array>;
    async(type: "arraybuffer"): Promise<ArrayBuffer>;
    async(type: "blob"): Promise<Blob>;
  }
  interface JSZip {
    file(name: string): JSZipObject | null;
    file(name: string, data: string | Uint8Array | ArrayBuffer | Blob): this;
    folder(name: string): JSZip;
    files: Record<string, JSZipObject>;
    generateAsync(options: { type: "blob" | "uint8array" | "arraybuffer"; compression?: string; compressionOptions?: object }): Promise<Blob | Uint8Array | ArrayBuffer>;
    loadAsync(data: string | Uint8Array | ArrayBuffer | Blob): Promise<JSZip>;
  }
  const JSZip: {
    new(): JSZip;
    loadAsync(data: string | Uint8Array | ArrayBuffer | Blob): Promise<JSZip>;
  };
  export = JSZip;
}

declare module "file-saver" {
  export function saveAs(data: Blob | Uint8Array | ArrayBuffer | string, filename?: string, options?: { autoBom?: boolean }): void;
}
