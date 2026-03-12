/**
 * Ambient type declarations for server-side modules that are used at runtime
 * but whose @types packages have peer-dependency conflicts.
 */

declare module "ssh2" {
  import { EventEmitter } from "events";
  export interface ConnectConfig {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    privateKey?: string | Buffer;
    passphrase?: string;
    readyTimeout?: number;
    keepaliveInterval?: number;
    keepaliveCountMax?: number;
  }
  export interface ExecOptions {
    env?: Record<string, string>;
    pty?: boolean | object;
  }
  export interface Channel extends NodeJS.ReadWriteStream {
    stderr: NodeJS.ReadableStream;
    close(): void;
    on(event: "close", listener: (code: number, signal: string) => void): this;
    on(event: "data", listener: (data: Buffer) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  export interface SFTPWrapper {
    fastPut(localPath: string, remotePath: string, callback: (err: Error | undefined) => void): void;
    fastGet(remotePath: string, localPath: string, callback: (err: Error | undefined) => void): void;
    readdir(location: string, callback: (err: Error | null, list: FileEntry[]) => void): void;
    unlink(path: string, callback: (err: Error | undefined) => void): void;
    mkdir(path: string, callback: (err: Error | undefined) => void): void;
    end(): void;
  }
  export interface FileEntry {
    filename: string;
    longname: string;
    attrs: { size: number; mtime: number; atime: number; mode: number };
  }
  export type ClientChannel = Channel;
  export class Client extends EventEmitter {
    connect(config: ConnectConfig): void;
    exec(command: string, callback: (err: Error | undefined, channel: Channel) => void): void;
    exec(command: string, options: ExecOptions, callback: (err: Error | undefined, channel: Channel) => void): void;
    sftp(callback: (err: Error | undefined, sftp: SFTPWrapper) => void): void;
    shell(callback: (err: Error | undefined, channel: Channel) => void): void;
    end(): void;
    on(event: "ready", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "end", listener: () => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}

declare module "archiver" {
  import { Transform } from "stream";
  interface ArchiverOptions {
    zlib?: { level?: number };
    store?: boolean;
  }
  interface Archiver extends Transform {
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
    append(source: NodeJS.ReadableStream | Buffer | string, data: { name: string }): this;
    file(filepath: string, data: { name: string }): this;
    directory(dirpath: string, destpath: string | false): this;
    glob(pattern: string, options?: object, data?: object): this;
    finalize(): Promise<void>;
    abort(): void;
    pointer(): number;
    on(event: "warning", listener: (err: Error) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  function archiver(format: "zip" | "tar" | "json", options?: ArchiverOptions): Archiver;
  export = archiver;
}

declare module "express-rate-limit" {
  import { Request, Response, NextFunction, RequestHandler } from "express";
  interface Options {
    windowMs?: number;
    max?: number | ((req: Request, res: Response) => number | Promise<number>);
    message?: string | object | ((req: Request, res: Response) => string | object);
    statusCode?: number;
    headers?: boolean;
    skipFailedRequests?: boolean;
    skipSuccessfulRequests?: boolean;
    keyGenerator?: (req: Request, res: Response) => string;
    skip?: (req: Request, res: Response) => boolean | Promise<boolean>;
    handler?: (req: Request, res: Response, next: NextFunction, options: Options) => void;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
  }
  function rateLimit(options?: Options): RequestHandler;
  export = rateLimit;
}

declare module "cookie-parser" {
  import { RequestHandler } from "express";
  function cookieParser(secret?: string | string[], options?: object): RequestHandler;
  export = cookieParser;
}
