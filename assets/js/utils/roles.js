// Hirarki role untuk menentukan akses tampilan dan aksi.
const ROLE_RANK = {
  member: 0,
  admin: 1,
  owner: 2,
  developer: 3,
};

export const roleRank = (role) => ROLE_RANK[role] ?? -1;

export const isAdminOrHigher = (role) => roleRank(role) >= ROLE_RANK.admin;

export const isOwnerOrDeveloper = (role) => roleRank(role) >= ROLE_RANK.owner;

export const roleLabel = (role) => ({
  admin: 'Admin',
  owner: 'Owner',
  developer: 'Developer',
  member: 'Anggota',
}[role] || 'Anggota');
