/// <reference types="vite/client" />

declare module '*.wav' {
  const src: string
  export default src
}

declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const workerFactory: {
    new (): Worker
  }
  export default workerFactory
}

declare module 'monaco-editor/esm/vs/language/json/json.worker?worker' {
  const workerFactory: {
    new (): Worker
  }
  export default workerFactory
}

declare module 'monaco-editor/esm/vs/language/css/css.worker?worker' {
  const workerFactory: {
    new (): Worker
  }
  export default workerFactory
}

declare module 'monaco-editor/esm/vs/language/html/html.worker?worker' {
  const workerFactory: {
    new (): Worker
  }
  export default workerFactory
}

declare module 'monaco-editor/esm/vs/language/typescript/ts.worker?worker' {
  const workerFactory: {
    new (): Worker
  }
  export default workerFactory
}
