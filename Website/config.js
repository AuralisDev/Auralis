(() => {
  const settings = {
    siteUrl: 'https://auralisdev.github.io/Auralis/',

    apiBase: 'https://auralis-api.wisp.uno',

    clientId: '1554961008064331826',

    discordInstall: {
      integrationType: 0,
      scopes: ['bot', 'applications.commands'],
      permissions: '1495484460247'
    },

    supportInvite: 'https://discord.gg/7DDGhHDDw',
    publicServerLimit: 48,
    defaultSort: 'largest',
    showLiveStatus: true,
    statusRefreshMs: 5000,
    statsRefreshMs: 5000,
    numberLocale: '',
    statisticsAnimation: {
      enabled: true,
      baseDurationMs: 1200,
      perMagnitudeMs: 620,
      maxDurationMs: 3200,
      easePower: 4.4
    },
    publicServerDescriptionFallback: 'No public description provided.'
  };

  const installParams = new URLSearchParams({
    client_id: settings.clientId,
    permissions: settings.discordInstall.permissions,
    integration_type: String(settings.discordInstall.integrationType),
    scope: settings.discordInstall.scopes.join(' ')
  });
  settings.discordInvite = `https://discord.com/oauth2/authorize?${installParams.toString()}`;

  window.AURALIS_CONFIG = Object.freeze(settings);
})();
