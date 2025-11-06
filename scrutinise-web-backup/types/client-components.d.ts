declare module '*.client' {
  import { ComponentType } from 'react';
  const component: ComponentType<any>;
  export default component;
}