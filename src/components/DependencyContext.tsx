import { createContext, useContext } from 'react';
import type { RedlevelsConfig } from '../types/redmine';
import { DependencyGraph, buildDependencies } from '../services/dependencies';

/** Dependency graph of the loaded issues, built once in App so cards, detail and tabs share it. */
export const EMPTY_DEPENDENCIES: DependencyGraph = buildDependencies([], {} as RedlevelsConfig);

const DependencyContext = createContext<DependencyGraph>(EMPTY_DEPENDENCIES);

export const DependencyProvider = DependencyContext.Provider;

export const useDependencies = () => useContext(DependencyContext);
