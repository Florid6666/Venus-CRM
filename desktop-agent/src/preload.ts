import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("omnios", {
  login: (email: string, password: string) => ipcRenderer.invoke("login", { email, password }),
});
