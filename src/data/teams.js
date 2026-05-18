export const defaultTeams = [
  { id: 'team-1', name: 'Aurora', color: '#82ffcf', flagLabel: 'A', playerCount: 3 },
  { id: 'team-2', name: 'Crimson', color: '#ff5f7d', flagLabel: 'C', playerCount: 3 },
  { id: 'team-3', name: 'Volt', color: '#ffcc66', flagLabel: 'V', playerCount: 3 },
  { id: 'team-4', name: 'Phantom', color: '#b991ff', flagLabel: 'P', playerCount: 3 },
];

export function cloneDefaultTeams(count = 2) {
  return defaultTeams.slice(0, count).map((team) => ({ ...team }));
}
