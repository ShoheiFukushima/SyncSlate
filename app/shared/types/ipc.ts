export type IpcChannels = {
  'dialog:openVideo': () => Promise<string | null>;
};