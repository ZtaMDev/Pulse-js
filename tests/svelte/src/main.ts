import { mount } from "svelte";
import App from "./App.svelte";

if (typeof window !== 'undefined') {
  mount(App, {
    target: document.getElementById("app") as HTMLElement,
  });
}
