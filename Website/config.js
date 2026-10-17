/*
 * Auralis public website configuration.
 *
 * This file is public. Never place DISCORD_TOKEN, DISCORD_CLIENT_SECRET,
 * SESSION_SECRET, OAuth access tokens, or any other secret in this file.
 *
 * Edit the settings below when you change your GitHub Pages repository,
 * Discord application, bot installation permissions, or backend host.
 */
(() => {
  const settings = {
    // Public website hosted by GitHub Pages.
    siteUrl: 'https://auralisdev.github.io/Auralis/',

    // Public HTTPS base URL of your running Node.js backend.
    // Public HTTPS backend currently configured for Auralis on WispByte.
    // This URL must serve /health and /public/api/servers; WispByte must forward
    // to the app's assigned port (currently shown as 12700 in the subdomain page).
    apiBase: 'https://auralis-api.wisp.uno',

    // Discord Developer Portal → General Information → Application ID.
    clientId: '1554961008064331826',

    // Bot installation link settings.
    // integrationType: 0 = Guild Install; 1 = User Install.
    // Auralis has moderation, tickets, server settings, and member events,
    // so use Guild Install (0). User Install alone cannot provide those bot powers.
    discordInstall: {
      integrationType: 0,
      scopes: ['bot', 'applications.commands'],
      permissions: '1495484460247'
    },

    supportInvite: '',
    publicServerLimit: 48,
    defaultSort: 'largest',
    showLiveStatus: true,
    statsRefreshMs: 60000,
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

  // Generate the invite URL from the settings above, so the application ID,
  // install context, scopes, and permission integer are all editable here.
  const installParams = new URLSearchParams({
    client_id: settings.clientId,
    permissions: settings.discordInstall.permissions,
    integration_type: String(settings.discordInstall.integrationType),
    scope: settings.discordInstall.scopes.join(' ')
  });
  settings.discordInvite = `https://discord.com/oauth2/authorize?${installParams.toString()}`;

  window.AURALIS_CONFIG = Object.freeze(settings);
})();
