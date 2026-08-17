// @ts-ignore — бандл генерируется на этапе билда Vercel
import bundle from './server-bundle.cjs';

const b = bundle as { app?: unknown; default?: unknown };
export default (b.app ?? b.default) as never;