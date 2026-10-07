import { Person } from './Person.js';
import { PoLineNote } from './PoLineNote.js';

export type AppSchema = {
  Person: Person;
  PoLineNote: PoLineNote;
};

export const schema = [Person, PoLineNote];
