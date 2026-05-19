export const defaultTeams = [
  { id: 'team-1', name: 'Ion', color: '#00a7ff', flagLabel: 'I', playerCount: 3 },
  { id: 'team-2', name: 'Neon', color: '#ff2bd6', flagLabel: 'N', playerCount: 3 },
  { id: 'team-3', name: 'Volt', color: '#ffe600', flagLabel: 'V', playerCount: 3 },
  { id: 'team-4', name: 'Void', color: '#7c3cff', flagLabel: 'V', playerCount: 3 },
];

export function cloneDefaultTeams(count = 2) {
  return defaultTeams.slice(0, count).map((team) => ({ ...team }));
}
