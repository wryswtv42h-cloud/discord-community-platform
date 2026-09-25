window.SITE_CONFIG = {
  name: 'ملاذ',
  shortName: 'MLD',
  owner: 'فهد المطيري',
  avatar: 'https://cdn.discordapp.com/attachments/1398447508463550578/1550544040401829888/IMG_0577.jpg?ex=6ab749ea&is=6ab5f86a&hm=9c7944ad338e389fed3f6002549f29112da4035937e46da302e57237de5bef90&',
  banner: '/server-banner.svg',
  welcome: 'حياكم الله في ملاذ — مساحة راقية لمجتمع MLD للعب والتجمع والاستمتاع.',
  discord: { username: 'w4px', invite: '' },
  access: {
    publicBrowsing: true,
    discordLoginRequired: false,
    accountRequiredForGroupsAndGames: true
  }
};

// Load the premium MLD skin after the base stylesheet without requiring a rebuild.
const mldTheme = document.createElement('link');
mldTheme.rel = 'stylesheet';
mldTheme.href = '/mld-theme.css?v=3';
document.head.appendChild(mldTheme);
