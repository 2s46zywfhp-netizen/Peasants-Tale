import stationsFile from '../../data/ontario-climate.json';
import townsFile from '../../data/reference-towns.json';
import type { RefTown, Station } from '../calc/climate';

export const stations = stationsFile.records as Station[];
export const towns = (townsFile.records as RefTown[]).slice().sort((a, b) => a.name.localeCompare(b.name));
