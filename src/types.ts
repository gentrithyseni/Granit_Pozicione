export type ThemeMode = 'light' | 'dark';

export type Project = {
  id: string;
  name: string;
  clientName: string;
  location: string;
  stage: 'draft' | 'active' | 'quoted' | 'finished';
};

export type Position = {
  id: string;
  projectId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  source: 'manual' | 'excel';
};

export type Category = {
  id: string;
  name: string;
  color: string;
  referenceCount: number;
};

export type ReferenceEntry = {
  id: string;
  categoryId: string;
  categoryName: string;
  projectName: string;
  status: 'quoted' | 'finished' | 'analyzed';
  score: number;
  note: string;
};