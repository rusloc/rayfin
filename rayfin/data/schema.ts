import { Person } from './Person.js';

export type AppSchema = {
  Person: Person;
};

export const schema = [Person];
