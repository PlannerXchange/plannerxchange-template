import { mount } from "./plugin";
import { mockRuntimeContext } from "./dev-context";

void Promise.resolve(mount(mockRuntimeContext));
