// Ambient global declarations for third-party browser SDKs loaded via <script> tags.
// No import/export — this file is a pure declaration file so all types are globally available.

interface DropboxChooserFile {
  link: string;
  name: string;
}

interface DropboxChooserOptions {
  success:      (files: DropboxChooserFile[]) => void;
  cancel:       () => void;
  linkType:     "preview" | "direct";
  multiselect:  boolean;
  extensions:   string[];
  folderselect: boolean;
}

interface GooglePickerDoc {
  id:       string;
  name:     string;
  mimeType: string;
}

interface GooglePickerResponse {
  action: string;
  docs:   GooglePickerDoc[];
}

interface GooglePickerBuilder {
  addView(view: unknown): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setCallback(cb: (data: GooglePickerResponse) => void): GooglePickerBuilder;
  build(): { setVisible(v: boolean): void };
}

interface Window {
  Dropbox?: {
    choose(opts: DropboxChooserOptions): void;
  };

  gapi?: {
    load(lib: string, cb: () => void): void;
    client?: unknown;
  };

  google?: {
    accounts: {
      oauth2: {
        initTokenClient(cfg: {
          client_id: string;
          scope:     string;
          callback:  (resp: { access_token?: string; error?: string }) => void;
        }): { requestAccessToken(): void };
      };
    };
    picker: {
      PickerBuilder: new () => GooglePickerBuilder;
      ViewId:  { DOCS: unknown };
      Action:  { PICKED: string };
    };
  };
}
