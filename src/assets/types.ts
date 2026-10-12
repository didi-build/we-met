export type StoredAsset = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
};

export type AssetStorage = {
  getObject(key: string): Promise<StoredAsset | null>;
};
