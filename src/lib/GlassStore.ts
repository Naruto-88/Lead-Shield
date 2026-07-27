import React from 'react';

type Listener = () => void;
let listeners: Listener[] = [];

// A global singleton to store DOM refs that need a WebGL Glass overlay
export const glassRegistry = new Set<React.RefObject<HTMLDivElement | null>>();

export const registerGlassRef = (ref: React.RefObject<HTMLDivElement | null>) => {
  glassRegistry.add(ref);
  listeners.forEach(l => l());
  return () => {
    glassRegistry.delete(ref);
    listeners.forEach(l => l());
  };
};

export const subscribeGlassRegistry = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};

export const getGlassRefs = () => Array.from(glassRegistry);
