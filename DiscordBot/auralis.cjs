const path = require('node:path');
process.env.AURALIS_ROOT ||= __dirname;
process.env.AURALIS_DATA_DIR ||= path.join(__dirname, 'Data');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const __factories = new Map();
__factories.set("src/commands.js", function(exports, require, module, __filename, __dirname) {
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCommands = buildCommands;
exports.commandDashboardCatalog = commandDashboardCatalog;
exports.handleCommand = handleCommand;
exports.handleComponent = handleComponent;
exports.getPrefixCommandDefinitions = getPrefixCommandDefinitions;
exports.handlePrefix = handlePrefix;
const discord_js_1 = require("discord.js");
const sharp_1 = __importDefault(require("sharp"));
const config_js_1 = require("./config.js");
const db_js_1 = require("./db.js");
const core_js_1 = require("./lib/core.js");
const ui_js_1 = require("./lib/ui.js");
const moderation_policy_js_1 = require("./lib/moderation-policy.js");
const tickets_js_1 = require("./systems/tickets.js");
const applications_js_1 = require("./systems/applications.js");
const moderation_js_1 = require("./systems/moderation.js");
const community_js_1 = require("./systems/community.js");
const giveaways_js_1 = require("./systems/giveaways.js");
const reactions_js_1 = require("./systems/reactions.js");
const security_js_1 = require("./systems/security.js");
const staff_activity_js_1 = require("./systems/staff-activity.js");
const polls_js_1 = require("./systems/polls.js");
const staffPerm = discord_js_1.PermissionFlagsBits.ManageMessages;
const adminPerm = discord_js_1.PermissionFlagsBits.Administrator;
const slash = [];
const COMMAND_MODULES = {
    tickets: 'tickets', close: 'tickets', add: 'tickets', remove: 'tickets', stats: 'tickets', leaderboard: 'tickets',
    applications: 'applications', staffactivity: 'staffactivity', warn: 'moderation', warnings: 'moderation', history: 'moderation',
    caselog: 'moderation', reason: 'moderation', ban: 'moderation', unban: 'moderation', banlist: 'moderation', tempban: 'moderation',
    kick: 'moderation', kicklist: 'moderation', punish: 'moderation', unpunish: 'moderation', untimeoutall: 'moderation', purge: 'moderation',
    cleanup: 'moderation', clearwarnings: 'moderation', unwarn: 'moderation', pardon: 'moderation', mute: 'moderation', tempmute: 'moderation', unmute: 'moderation', punishmentstats: 'moderation', lockdown: 'moderation', unlock: 'moderation', lockdownall: 'moderation', unlockdownall: 'moderation', panel: 'panels',
    strip: 'moderation', jail: 'jail', unjail: 'jail', jailed: 'jail', setjail: 'jail', setjailauto: 'jail',
    imgonly: 'imageonly', honeypot: 'honeypot', antinuke: 'antinuke', verify: 'verify', poll: 'polls', giveaways: 'giveaways',
    suggest: 'suggestions', reactionrole: 'reactionroles', buttonrole: 'buttonroles', boosterrole: 'boosterroles',
    level: 'levels', levelup: 'levels', timezone: 'timezones', time: 'timezones', birthday: 'birthdays',
    counter: 'counters', sticky: 'sticky', tag: 'tags', customcmd: 'customcmd', embed: 'embeds', webhook: 'webhooks',
    snipe: 'snipe', economy: 'economy', joke: 'fun', translate: 'utility', crypto: 'utility', announce: 'announcements'
};
const CONFIGURABLE_COMMAND_PERMISSIONS = new Set([
    'Administrator', 'ManageGuild', 'ManageMessages', 'ManageChannels', 'ManageRoles',
    'ModerateMembers', 'KickMembers', 'BanMembers', 'ViewAuditLog', 'ManageThreads', 'EmbedLinks', 'None'
]);
function applicationCommandAccessFailure(interaction, cfg) {
    if (interaction.commandName !== 'applications')
        return null;
    const subcommand = interaction.options.getSubcommand(false);
    if (subcommand === 'panel') {
        return (0, core_js_1.isStaff)(interaction.member) ? null : 'Sending an application panel requires server staff permissions.';
    }
    if (!['list', 'review'].includes(subcommand))
        return null;
    const configuredRoles = (cfg?.applicationDefaults?.reviewRoleIds || []).map(String).filter(Boolean);
    const isGuildOwner = String(interaction.user?.id || '') === String(interaction.guild?.ownerId || '');
    const isAdministrator = interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.Administrator);
    const canManageGuild = interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageGuild);
    if (isGuildOwner || isAdministrator || canManageGuild)
        return null;
    if (configuredRoles.length) {
        const memberRoles = interaction.member?.roles?.cache;
        if (configuredRoles.some(roleId => memberRoles?.has(roleId)))
            return null;
        return 'Application reviewing requires one of the reviewer roles configured in Dashboard → Applications.';
    }
    return (0, core_js_1.isStaff)(interaction.member) ? null : 'Application review requires staff permissions or configured reviewer roles.';
}
const MODERATION_REASON_ACTIONS = Object.freeze({
    warn: 'WARN', unwarn: 'UNWARN', clearwarnings: 'CLEARWARNINGS', ban: 'BAN', unban: 'UNBAN',
    tempban: 'TEMPBAN', kick: 'KICK', mute: 'TIMEOUT', tempmute: 'TIMEOUT', unmute: 'UNTIMEOUT',
    pardon: 'PARDON', strip: 'STRIP', jail: 'JAIL'
});
function configuredReasonFailure(interaction, cfg, name) {
    const action = MODERATION_REASON_ACTIONS[name];
    if (!action)
        return null;
    const requiredActions = Array.isArray(cfg?.moderation?.reasonRequiredFor) ? cfg.moderation.reasonRequiredFor.map(value => String(value).toUpperCase()) : [];
    if (!requiredActions.includes(action))
        return null;
    const reason = interaction.options.getString('reason', false)?.trim();
    if (reason)
        return null;
    const data = commandDefinitions.get(name)?.toJSON();
    const options = (data?.options || []).filter(option => ![1, 2].includes(Number(option.type)));
    const sampleValues = {
        user: '@Member', member: '@Member', target: '@Member', duration: '10m',
        user_id: '123456789012345678', warning_id: '123', channel: '#channel',
        role: '@Role', reason: 'Your reason', amount: '10', page: '1'
    };
    const sampleArgs = options.filter(option => option.required || option.name === 'reason')
        .map(option => `${option.name}:${sampleValues[String(option.name).toLowerCase()] ?? `<${option.name}>`}`);
    const example = `/${name}${sampleArgs.length ? ` ${sampleArgs.join(' ')}` : ' reason:Your reason'}`;
    return `A reason is required for /${name} in this server. Add the \`reason\` option to the command, or ask an administrator to change Dashboard → Moderation → Required reasons. Example: \`${example}\`.`;
}
function commandAccessFailure(interaction, cfg, name) {
    const rule = cfg?.commandPermissions?.[name];
    if (rule?.enabled === false)
        return `The /${name} command is disabled for this server. An administrator can enable it in the Dashboard.`;
    if (rule?.roleId && !interaction.member?.roles?.cache?.has(String(rule.roleId))) {
        return `The /${name} command requires the configured staff role.`;
    }
    const permission = String(rule?.permission ?? 'None');
    if (permission !== 'None') {
        const bit = discord_js_1.PermissionFlagsBits[permission];
        if (!bit || !interaction.memberPermissions?.has(bit))
            return `The /${name} command requires the server permission **${permission}**.`;
    }
    const moduleName = COMMAND_MODULES[name];
    if (moduleName && cfg?.modules?.[moduleName] === false) {
        return `The ${moduleName} module is disabled for this server. Enable it in the Dashboard to use /${name}.`;
    }
    return null;
}
function moderationResponse(cfg, key, values = {}, fallback = 'The moderation action completed.') {
    const configured = String(cfg?.moderation?.responseTemplates?.[key] ?? '').trim();
    const template = configured || fallback;
    return (0, core_js_1.truncate)((0, core_js_1.replacePlaceholders)(template, {
        server: values.server ?? '', moderator: values.moderator ?? '', reason: values.reason ?? 'No reason provided.',
        ...values
    }), 1900);
}
function dmDeliveryLabel(sent) { return sent ? 'sent' : 'could not be delivered (the member may have closed DMs or blocked server messages)'; }
function timestampLabel(ms) { return Number(ms) > 0 ? `<t:${Math.floor(Number(ms) / 1000)}:F>` : 'not recorded'; }
function add(builder) { slash.push(builder); return builder; }
function base(name, description) { return new discord_js_1.SlashCommandBuilder().setName(name).setDescription(description); }
function userOpt(builder, name, description, required = true) { return builder.addUserOption(o => o.setName(name).setDescription(description).setRequired(required)); }
function channelOpt(builder, name, description, required = false) { return builder.addChannelOption(o => o.setName(name).setDescription(description).setRequired(required)); }
function roleOpt(builder, name, description, required = true) { return builder.addRoleOption(o => o.setName(name).setDescription(description).setRequired(required)); }
function strOpt(builder, name, description, required = true, max = 1000) { return builder.addStringOption(o => o.setName(name).setDescription(description).setRequired(required).setMaxLength(max)); }
function intOpt(builder, name, description, required = true, min = 1, max = 1000000) { return builder.addIntegerOption(o => o.setName(name).setDescription(description).setRequired(required).setMinValue(min).setMaxValue(max)); }
add(base('setup', 'Interactive Auralis server configuration menu').setDefaultMemberPermissions(adminPerm));
add(base('panel', 'Send a configured Auralis panel to a channel').setDefaultMemberPermissions(adminPerm)
    .addSubcommand(s => s.setName('send').setDescription('Send a configured panel')
    .addStringOption(o => o.setName('type').setDescription('Panel type').setRequired(true).addChoices({ name: 'Ticket panel', value: 'ticket' }, { name: 'Application panel', value: 'application' }, { name: 'Staff activity check', value: 'staffactivity' }, { name: 'Verification panel', value: 'verification' }, { name: 'Setup menu', value: 'setup' }))
    .addChannelOption(o => o.setName('channel').setDescription('Target text channel; defaults to this channel').setRequired(false).addChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement))
    .addStringOption(o => o.setName('panel').setDescription('Ticket panel name or ID (ticket panels only)').setRequired(false))));
add(base('help', 'Browse Auralis commands').addStringOption(o => o.setName('category').setDescription('Category').setRequired(false).addChoices(...Object.keys(config_js_1.config.commandGroups).map(group => ({ name: group.charAt(0).toUpperCase() + group.slice(1), value: group })))).addIntegerOption(o => o.setName('page').setDescription('Page').setRequired(false).setMinValue(1).setMaxValue(50)));
add(base('tickets', 'List or manage support tickets').addSubcommand(s => s.setName('list').setDescription('List open tickets')).addSubcommand(s => s.setName('panel').setDescription('Send a ticket panel here').addStringOption(o => o.setName('panel').setDescription('Panel name or ID').setRequired(false))).addSubcommand(s => s.setName('stats').setDescription('Ticket statistics')).addSubcommand(s => s.setName('leaderboard').setDescription('Top ticket staff')));
add(base('staffactivity', 'Staff activity check tools').setDefaultMemberPermissions(staffPerm).addSubcommand(s => s.setName('panel').setDescription('Send the staff activity panel').addChannelOption(o => o.setName('channel').setDescription('Panel channel').setRequired(false))).addSubcommand(s => s.setName('check').setDescription('Check staff activity').addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(false))).addSubcommand(s => s.setName('leaderboard').setDescription('Show staff activity leaderboard').addIntegerOption(o => o.setName('page').setDescription('Page').setRequired(false).setMinValue(1))));
add(base('applications', 'Staff, partner and creator applications').addSubcommand(s => s.setName('panel').setDescription('Send an application panel here').addStringOption(o => o.setName('panel').setDescription('Application panel ID configured in the dashboard').setRequired(false).setMaxLength(40))).addSubcommand(s => s.setName('list').setDescription('List applications').addStringOption(o => o.setName('status').setDescription('Filter status').addChoices({ name: 'Pending', value: 'pending' }, { name: 'Accepted', value: 'accepted' }, { name: 'Rejected', value: 'rejected' }, { name: 'All', value: 'all' }))).addSubcommand(s => s.setName('review').setDescription('Review an application').addIntegerOption(o => o.setName('id').setDescription('Application ID').setRequired(true).setMinValue(1)).addStringOption(o => o.setName('action').setDescription('Decision').addChoices({ name: 'Accept', value: 'accepted' }, { name: 'Reject', value: 'rejected' }).setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Optional reason').setRequired(false).setMaxLength(1000))));
add(base('close', 'Close the current ticket').setDefaultMemberPermissions(staffPerm));
add(base('add', 'Add a member to the current ticket').setDefaultMemberPermissions(staffPerm).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)));
add(base('remove', 'Remove a member from the current ticket').setDefaultMemberPermissions(staffPerm).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)));
add(base('picperms', 'Toggle the pic-perms role').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)));
add(base('stats', 'Server ticket stats'));
add(base('leaderboard', 'Top staff by ticket closes'));
add(base('warn', 'Warn a user').setDefaultMemberPermissions(staffPerm).addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Optional unless required in Dashboard → Moderation').setRequired(false).setMaxLength(1000)));
add(base('warnings', 'List a user\'s active warnings').setDefaultMemberPermissions(staffPerm).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)));
add(base('unwarn', 'Remove one active warning by its warning ID').setDefaultMemberPermissions(staffPerm).addIntegerOption(o => o.setName('warning_id').setDescription('Warning ID shown by /warnings').setRequired(true).setMinValue(1)).addStringOption(o => o.setName('reason').setDescription('Reason for removing the warning').setRequired(false).setMaxLength(500)));
add(base('clearwarnings', 'Clear all active warnings for a member without deleting audit history').setDefaultMemberPermissions(staffPerm).addUserOption(o => o.setName('user').setDescription('Member whose active warnings should be cleared').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason for clearing active warnings').setRequired(false).setMaxLength(500)));
add(base('punishmentstats', 'Show recorded punishment counts for a member').setDefaultMemberPermissions(staffPerm).addUserOption(o => o.setName('user').setDescription('Member to inspect').setRequired(true)));
add(base('history', 'Full case history').setDefaultMemberPermissions(staffPerm).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)));
add(base('caselog', 'Show one case').setDefaultMemberPermissions(staffPerm).addIntegerOption(o => o.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1)));
add(base('reason', 'Update a case reason').setDefaultMemberPermissions(staffPerm).addIntegerOption(o => o.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1)).addStringOption(o => o.setName('new').setDescription('New reason').setRequired(true).setMaxLength(1000)));
add(base('ban', 'Ban a user').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.BanMembers).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Optional unless required in Dashboard → Moderation').setRequired(false)));
add(base('unban', 'Unban by user ID').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.BanMembers).addStringOption(o => o.setName('user_id').setDescription('Discord user ID to unban').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Optional audit-log reason').setRequired(false).setMaxLength(1000)));
add(base('banlist', 'Paginated list of currently banned users').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.BanMembers).addIntegerOption(o => o.setName('page').setDescription('Page').setRequired(false).setMinValue(1)));
add(base('tempban', 'Temporary ban').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.BanMembers).addUserOption(o => o.setName('user').setDescription('Member to ban').setRequired(true)).addStringOption(o => o.setName('duration').setDescription('10m, 2h, 7d').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Optional unless required in Dashboard → Moderation').setRequired(false).setMaxLength(1000)));
add(base('kick', 'Kick a user').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.KickMembers).addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Optional unless required in Dashboard → Moderation').setRequired(false).setMaxLength(1000)));
add(base('kicklist', 'Recent kicks').setDefaultMemberPermissions(staffPerm).addIntegerOption(o => o.setName('page').setDescription('Page').setRequired(false).setMinValue(1)));
add(base('mute', 'Timeout a member for the selected duration').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers).addUserOption(o => o.setName('user').setDescription('Member to mute with Discord timeout').setRequired(true)).addStringOption(o => o.setName('duration').setDescription('Duration, e.g. 10m, 2h, 7d (max 28d)').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Optional unless required in Dashboard → Moderation').setRequired(false).setMaxLength(1000)));
add(base('tempmute', 'Temporarily mute a member using Discord timeout').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers).addUserOption(o => o.setName('user').setDescription('Member to mute').setRequired(true)).addStringOption(o => o.setName('duration').setDescription('Duration, e.g. 10m, 2h, 7d (max 28d)').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Optional unless required in Dashboard → Moderation').setRequired(false).setMaxLength(1000)));
add(base("unmute", "Remove a member's active Discord timeout").setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers).addUserOption(o => o.setName('user').setDescription('Member to unmute').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Optional audit-log reason').setRequired(false).setMaxLength(1000)));
add(base("pardon", "Clear a member's active warnings but retain history").setDefaultMemberPermissions(staffPerm).addUserOption(o => o.setName('user').setDescription('Member to pardon').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason for the pardon').setRequired(false).setMaxLength(500)));
add(base('untimeoutall', 'Remove timeout from everyone').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers));
add(base('purge', 'Bulk-delete messages').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages).addIntegerOption(o => o.setName('amount').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100)));
add(base('cleanup', 'Delete bot/command messages').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages).addIntegerOption(o => o.setName('amount').setDescription('1-100').setRequired(false).setMinValue(1).setMaxValue(100)));
add(base('lockdown', 'Lock a channel').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels).addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false).addChannelTypes(discord_js_1.ChannelType.GuildText)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)));
add(base('unlock', 'Unlock a channel').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels).addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false).addChannelTypes(discord_js_1.ChannelType.GuildText)));
add(base('lockdownall', 'Lock every text channel').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels));
add(base('unlockdownall', 'Unlock every text channel').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels));
add(base('strip', 'Remove manageable roles').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles).addUserOption(o => o.setName('user').setDescription('Member whose roles should be removed').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Optional unless required in Dashboard → Moderation').setRequired(false).setMaxLength(1000)));
add(base('jail', 'Jail a user').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)));
add(base('unjail', 'Release a jailed user').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)));
add(base('jailed', 'Show currently jailed members').setDefaultMemberPermissions(staffPerm).addIntegerOption(o => o.setName('page').setDescription('Page').setRequired(false).setMinValue(1)));
add(base('setjail', 'Set the jail role/channel').setDefaultMemberPermissions(adminPerm).addRoleOption(o => o.setName('role').setDescription('Jail role').setRequired(true)).addChannelOption(o => o.setName('channel').setDescription('Jail channel').setRequired(false)));
add(base('setjailauto', 'Show jail auto configuration').setDefaultMemberPermissions(adminPerm));
add(base('pin', 'Pin a message').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages).addStringOption(o => o.setName('link').setDescription('Message link').setRequired(true)));
add(base('unpin', 'Unpin a message').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages).addStringOption(o => o.setName('link').setDescription('Message link').setRequired(true)));
add(base('hide', 'Hide a channel').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels).addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false)).addRoleOption(o => o.setName('role').setDescription('Role').setRequired(false)).addUserOption(o => o.setName('user').setDescription('Member').setRequired(false)));
add(base('unhide', 'Reveal a channel').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels).addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false)).addRoleOption(o => o.setName('role').setDescription('Role').setRequired(false)).addUserOption(o => o.setName('user').setDescription('Member').setRequired(false)));
add(base('slowmode', 'Set channel slowmode').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels).addIntegerOption(o => o.setName('secs').setDescription('Seconds, 0 = off').setRequired(true).setMinValue(0).setMaxValue(21600)));
add(base('nsfw', 'Toggle channel NSFW').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels).addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false).addChannelTypes(discord_js_1.ChannelType.GuildText)));
add(base('audit', 'Recent audit-log entries').setDefaultMemberPermissions(staffPerm).addIntegerOption(o => o.setName('limit').setDescription('1-20').setRequired(false).setMinValue(1).setMaxValue(20)));
const antinuke = base('antinuke', 'Anti-nuke security').setDefaultMemberPermissions(adminPerm)
    .addSubcommand(s => s.setName('status').setDescription('Show security status'))
    .addSubcommand(s => s.setName('toggle').setDescription('Toggle a module').addStringOption(o => o.setName('module').setDescription('channel/role/ban/kick/bot-add').setRequired(true).addChoices(...['channel', 'role', 'ban', 'kick', 'bot-add'].map(x => ({ name: x, value: x })))))
    .addSubcommand(s => s.setName('whitelist_add').setDescription('Whitelist a user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('whitelist_remove').setDescription('Remove whitelist').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)));
add(antinuke);
add(base('level', 'Level system')
    .addSubcommand(s => s.setName('rank').setDescription('Show XP and level').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('Top XP earners'))
    .addSubcommand(s => s.setName('enable').setDescription('Enable levels'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable levels'))
    .addSubcommand(s => s.setName('addrole').setDescription('Set a level reward').addIntegerOption(o => o.setName('level').setDescription('Level').setRequired(true).setMinValue(1)).addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('removerole').setDescription('Remove a reward').addIntegerOption(o => o.setName('level').setDescription('Level').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('listroles').setDescription('List rewards'))
    .addSubcommand(s => s.setName('stack').setDescription('Keep all reward roles').addBooleanOption(o => o.setName('enabled').setDescription('Enabled').setRequired(true)))
    .addSubcommand(s => s.setName('announce').setDescription('Set level-up channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false)))
    .addSubcommand(s => s.setName('setxp').setDescription('Set XP').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('xp').setDescription('XP').setRequired(true).setMinValue(0)))
    .addSubcommand(s => s.setName('setlevel').setDescription('Set level').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('level').setDescription('Level').setRequired(true).setMinValue(0)))
    .addSubcommand(s => s.setName('reset').setDescription('Reset XP').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('sync').setDescription('Re-apply rewards')));
add(base('autorole', 'Auto-role management')
    .addSubcommand(s => s.setName('add').setDescription('Add an auto-role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove an auto-role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List auto-roles'))
    .addSubcommand(s => s.setName('reset').setDescription('Clear all')));
add(base('reactionrole', 'Reaction roles')
    .addSubcommand(s => s.setName('add').setDescription('Add binding').addStringOption(o => o.setName('msg').setDescription('Message ID').setRequired(true)).addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true)).addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove binding').addStringOption(o => o.setName('msg').setDescription('Message ID').setRequired(true)).addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true)))
    .addSubcommand(s => s.setName('removeall').setDescription('Remove all bindings').addStringOption(o => o.setName('msg').setDescription('Message ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List bindings'))
    .addSubcommand(s => s.setName('reset').setDescription('Reset all'))
    .addSubcommand(s => s.setName('restore').setDescription('Toggle restore on rejoin').addBooleanOption(o => o.setName('enabled').setDescription('Enabled').setRequired(true))));
add(base('buttonrole', 'Button roles')
    .addSubcommand(s => s.setName('add').setDescription('Add a button role').addStringOption(o => o.setName('msg').setDescription('Message ID').setRequired(true)).addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)).addStringOption(o => o.setName('style').setDescription('Primary/Secondary/Success/Danger')).addStringOption(o => o.setName('emoji').setDescription('Emoji')).addStringOption(o => o.setName('label').setDescription('Label')))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a button').addStringOption(o => o.setName('msg').setDescription('Message ID').setRequired(true)).addIntegerOption(o => o.setName('index').setDescription('Index').setRequired(true).setMinValue(0)))
    .addSubcommand(s => s.setName('removeall').setDescription('Remove all buttons').addStringOption(o => o.setName('msg').setDescription('Message ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List button roles'))
    .addSubcommand(s => s.setName('reset').setDescription('Reset all buttons')));
add(base('boosterrole', 'Custom booster role')
    .addSubcommand(s => s.setName('color').setDescription('Create or recolor').addStringOption(o => o.setName('hex').setDescription('#8B7CFF').setRequired(true)))
    .addSubcommand(s => s.setName('rename').setDescription('Rename your booster role').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true).setMaxLength(32)))
    .addSubcommand(s => s.setName('remove').setDescription('Delete your booster role'))
    .addSubcommand(s => s.setName('setbase').setDescription('Set base role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('limit').setDescription('Max custom roles').addIntegerOption(o => o.setName('number').setDescription('Number').setRequired(true).setMinValue(1).setMaxValue(250)))
    .addSubcommand(s => s.setName('disable').setDescription('Disable'))
    .addSubcommand(s => s.setName('enable').setDescription('Enable'))
    .addSubcommand(s => s.setName('list').setDescription('List booster roles'))
    .addSubcommand(s => s.setName('cleanup').setDescription('Remove invalid roles')));
add(base('tag', 'Tag management')
    .addSubcommand(s => s.setName('get').setDescription('Recall a tag').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)))
    .addSubcommand(s => s.setName('add').setDescription('Create a tag').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)).addStringOption(o => o.setName('content').setDescription('Content').setRequired(true).setMaxLength(1800)))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a tag').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)).addStringOption(o => o.setName('content').setDescription('Content').setRequired(true).setMaxLength(1800)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a tag').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List tags')));
add(base('customcmd', 'Custom prefix replies')
    .addSubcommand(s => s.setName('add').setDescription('Add a custom command').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)).addStringOption(o => o.setName('reply').setDescription('Reply').setRequired(true).setMaxLength(1900)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a custom command').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List custom commands')));
add(base('sticky', 'Sticky messages')
    .addSubcommand(s => s.setName('set').setDescription('Set sticky message').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true).setMaxLength(1900)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove sticky'))
    .addSubcommand(s => s.setName('list').setDescription('List stickies')));
add(base('counter', 'Channel counters')
    .addSubcommand(s => s.setName('add').setDescription('Add counter').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)).addStringOption(o => o.setName('metric').setDescription('Metric').setRequired(true).addChoices(...['members', 'humans', 'bots', 'boosts', 'roles', 'channels', 'voice', 'text'].map(x => ({ name: x, value: x })))))
    .addSubcommand(s => s.setName('remove').setDescription('Remove counter').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List counters')));
add(base('imgonly', 'Image-only channels and violation thresholds').setDefaultMemberPermissions(adminPerm)
    .addSubcommand(s => s.setName('add').setDescription('Enable image-only').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Disable image-only').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List image-only channels'))
    .addSubcommand(s => s.setName('configure').setDescription('Configure warnings and timeout thresholds')
    .addBooleanOption(o => o.setName('warnings').setDescription('Enable warnings').setRequired(false))
    .addIntegerOption(o => o.setName('warning_threshold').setDescription('Warnings after this many violations').setMinValue(1).setMaxValue(100).setRequired(false))
    .addIntegerOption(o => o.setName('window_seconds').setDescription('Violation window in seconds').setMinValue(10).setMaxValue(86400).setRequired(false))
    .addStringOption(o => o.setName('notify').setDescription('How to deliver warnings').addChoices({ name: 'DM', value: 'dm' }, { name: 'Channel', value: 'channel' }, { name: 'Both', value: 'both' }, { name: 'None', value: 'none' }).setRequired(false))
    .addBooleanOption(o => o.setName('timeout_enabled').setDescription('Enable threshold timeouts').setRequired(false))
    .addIntegerOption(o => o.setName('timeout_threshold').setDescription('Timeout after this many violations').setMinValue(2).setMaxValue(100).setRequired(false))
    .addIntegerOption(o => o.setName('timeout_seconds').setDescription('Timeout duration in seconds').setMinValue(1).setMaxValue(2419200).setRequired(false))));
add(base('honeypot', 'Configure hidden anti-bot trap channels').setDefaultMemberPermissions(adminPerm)
    .addSubcommand(s => s.setName('add').setDescription('Add a honeypot channel').addChannelOption(o => o.setName('channel').setDescription('Trap channel').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a honeypot channel').addChannelOption(o => o.setName('channel').setDescription('Trap channel').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List honeypot settings'))
    .addSubcommand(s => s.setName('configure').setDescription('Configure honeypot actions')
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable honeypot').setRequired(false))
    .addIntegerOption(o => o.setName('threshold').setDescription('Hits before action').setMinValue(1).setMaxValue(100).setRequired(false))
    .addIntegerOption(o => o.setName('window_seconds').setDescription('Counting window in seconds').setMinValue(10).setMaxValue(86400).setRequired(false))
    .addStringOption(o => o.setName('action').setDescription('Action after threshold').addChoices({ name: 'Log only', value: 'log' }, { name: 'Warn', value: 'warn' }, { name: 'Timeout', value: 'timeout' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }).setRequired(false))
    .addIntegerOption(o => o.setName('timeout_seconds').setDescription('Timeout duration in seconds').setMinValue(1).setMaxValue(2419200).setRequired(false))
    .addChannelOption(o => o.setName('log_channel').setDescription('Security log channel').setRequired(false))
    .addBooleanOption(o => o.setName('notify_user').setDescription('Send the user a DM').setRequired(false))));
add(base('verify', 'Verification panel').setDefaultMemberPermissions(adminPerm).addSubcommand(s => s.setName('setup').setDescription('Send verify panel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)).addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))));
add(base('suggest', 'Suggestions')
    .addSubcommand(s => s.setName('new').setDescription('Submit a suggestion').addStringOption(o => o.setName('text').setDescription('Suggestion').setRequired(true).setMaxLength(1900)))
    .addSubcommand(s => s.setName('setchannel').setDescription('Set channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s.setName('approve').setDescription('Approve').addIntegerOption(o => o.setName('id').setDescription('Suggestion ID').setRequired(true)))
    .addSubcommand(s => s.setName('deny').setDescription('Deny').addIntegerOption(o => o.setName('id').setDescription('Suggestion ID').setRequired(true))));
add(base('poll', 'Create a configurable poll with live vote counts and an optional end time').addStringOption(o => o.setName('question').setDescription('Question shown in the poll').setRequired(true).setMaxLength(500)).addStringOption(o => o.setName('opt1').setDescription('Option 1').setRequired(true).setMaxLength(100)).addStringOption(o => o.setName('opt2').setDescription('Option 2').setRequired(true).setMaxLength(100)).addStringOption(o => o.setName('opt3').setDescription('Option 3').setRequired(false).setMaxLength(100)).addStringOption(o => o.setName('opt4').setDescription('Option 4').setRequired(false).setMaxLength(100)).addStringOption(o => o.setName('opt5').setDescription('Option 5').setRequired(false).setMaxLength(100)).addStringOption(o => o.setName('title').setDescription('Optional embed title').setRequired(false).setMaxLength(256)).addStringOption(o => o.setName('description').setDescription('Optional description above the question').setRequired(false).setMaxLength(1000)).addStringOption(o => o.setName('duration').setDescription('How long the poll runs, e.g. 30m, 12h, 7d').setRequired(false).setMaxLength(20)).addChannelOption(o => o.setName('channel').setDescription('Where to send it; defaults to this channel').setRequired(false).addChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement)));
const giveaways = base('giveaways', 'Create, manage, and reroll server giveaways')
    .addSubcommand(s => s.setName('start').setDescription('Start a giveaway using this channel or a selected channel').addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true).setMaxLength(250)).addChannelOption(o => o.setName('channel').setDescription('Target channel; defaults to this channel').setRequired(false).addChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement)).addStringOption(o => o.setName('duration').setDescription('Duration such as 10m, 2h, or 7d; defaults to the Dashboard setting').setRequired(false).setMaxLength(20)).addIntegerOption(o => o.setName('winners').setDescription('Number of winners; defaults to the Dashboard setting').setRequired(false).setMinValue(1).setMaxValue(25)).addStringOption(o => o.setName('title').setDescription('Optional embed title').setRequired(false).setMaxLength(256)).addStringOption(o => o.setName('description').setDescription('Optional embed description').setRequired(false).setMaxLength(1000)))
    .addSubcommand(s => s.setName('end').setDescription('End an active giveaway').addStringOption(o => o.setName('msg').setDescription('Giveaway message ID').setRequired(true)))
    .addSubcommand(s => s.setName('reroll').setDescription('Select a new winner from eligible entrants').addStringOption(o => o.setName('msg').setDescription('Giveaway message ID').setRequired(true)).addIntegerOption(o => o.setName('winners').setDescription('Number of replacement winners').setRequired(false).setMinValue(1).setMaxValue(25)))
    .addSubcommand(s => s.setName('cancel').setDescription('Cancel an active giveaway').addStringOption(o => o.setName('msg').setDescription('Giveaway message ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List active server giveaways'))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a stored giveaway field').addStringOption(o => o.setName('msg').setDescription('Giveaway message ID').setRequired(true)).addStringOption(o => o.setName('field').setDescription('Field to update').setRequired(true).addChoices({ name: 'Title', value: 'title' }, { name: 'Prize', value: 'prize' }, { name: 'Description', value: 'description' }, { name: 'Winners', value: 'winners' }, { name: 'End time / duration', value: 'duration' }, { name: 'Embed color', value: 'color' })).addStringOption(o => o.setName('value').setDescription('New value').setRequired(true).setMaxLength(1000)));
add(giveaways);
add(base('time', 'Show local time').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)));
add(base('timezone', 'Timezone')
    .addSubcommand(s => s.setName('set').setDescription('Set IANA timezone').addStringOption(o => o.setName('iana').setDescription('Europe/Berlin').setRequired(true)))
    .addSubcommand(s => s.setName('view').setDescription('Show timezone').addUserOption(o => o.setName('user').setDescription('User').setRequired(false))));
add(base('birthday', 'Birthday')
    .addSubcommand(s => s.setName('set').setDescription('Set MM-DD').addStringOption(o => o.setName('date').setDescription('MM-DD').setRequired(true)))
    .addSubcommand(s => s.setName('view').setDescription('View birthday').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)))
    .addSubcommand(s => s.setName('list').setDescription('List birthdays'))
    .addSubcommand(s => s.setName('setchannel').setDescription('Set birthday channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s.setName('setrole').setDescription('Set birthday role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))));
add(base('commands', 'Prefix command toggles').setDefaultMemberPermissions(adminPerm).addStringOption(o => o.setName('command').setDescription('Command name').setRequired(true)).addBooleanOption(o => o.setName('enabled').setDescription('Enabled').setRequired(true)));
add(base('template', 'DM templates').setDefaultMemberPermissions(adminPerm).addSubcommand(s => s.setName('view').setDescription('View template').addStringOption(o => o.setName('action').setDescription('Action').setRequired(true))).addSubcommand(s => s.setName('set').setDescription('Set template').addStringOption(o => o.setName('action').setDescription('Action').setRequired(true)).addStringOption(o => o.setName('message').setDescription('Message').setRequired(true).setMaxLength(1900))).addSubcommand(s => s.setName('reset').setDescription('Reset template').addStringOption(o => o.setName('action').setDescription('Action').setRequired(true))));
add(base('webhook', 'Webhook tools').setDefaultMemberPermissions(adminPerm).addSubcommand(s => s.setName('create').setDescription('Create webhook').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true))).addSubcommand(s => s.setName('list').setDescription('List webhooks')).addSubcommand(s => s.setName('delete').setDescription('Delete webhook').addStringOption(o => o.setName('id').setDescription('Webhook ID').setRequired(true))).addSubcommand(s => s.setName('send').setDescription('Send').addStringOption(o => o.setName('id').setDescription('Webhook ID').setRequired(true)).addStringOption(o => o.setName('message').setDescription('Message').setRequired(true))));
add(base('embed', 'Send a custom embed').setDefaultMemberPermissions(adminPerm));
add(base('announce', 'Send a staff announcement').setDefaultMemberPermissions(staffPerm).addStringOption(o => o.setName('message').setDescription('Announcement').setRequired(true).setMaxLength(1000)).addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false)));
add(base('serverinfo', 'Server information'));
add(base('userinfo', 'User information').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)));
add(base('channelinfo', 'Channel information').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false)));
add(base('roleinfo', 'Role information').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)));
add(base('avatar', 'Global avatar').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)));
add(base('banner', 'Global banner').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)));
add(base('membercount', 'Member breakdown'));
add(base('roles', 'Server roles'));
add(base('emojis', 'Server emojis'));
add(base('stickers', 'Server stickers'));
add(base('inrole', 'Role members').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)).addIntegerOption(o => o.setName('page').setDescription('Page').setRequired(false).setMinValue(1)));
add(base('newusers', 'Newest members').addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(false).setMinValue(1).setMaxValue(25)));
add(base('boomer', 'Oldest member'));
add(base('invite', 'Bot invite'));
add(base('inviteinfo', 'Inspect a Discord invite').addStringOption(o => o.setName('code').setDescription('Invite code').setRequired(true)));
add(base('invites', 'List active invites'));
add(base('translate', 'Translate text').addStringOption(o => o.setName('lang').setDescription('Target language code').setRequired(true)).addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)));
add(base('crypto', 'Crypto prices'));
add(base('color', 'Inspect a color').addStringOption(o => o.setName('hex').setDescription('#8B7CFF').setRequired(true)));
add(base('randomhex', 'Random hex color'));
add(base('remind', 'Set a reminder').addStringOption(o => o.setName('duration').setDescription('10m, 2h').setRequired(true)).addStringOption(o => o.setName('message').setDescription('Message').setRequired(true)));
add(base('afk', 'Set or remove AFK').addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)));
add(base('ping', 'Gateway latency'));
add(base('botinfo', 'Bot information'));
add(base('prefix', 'Show server prefix'));
add(base('levelup', 'Internal alias for level rank').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)));
const commandDefinitions = new Map(slash.map(x => [x.name, x]));
function buildCommands() { return slash; }
function dashboardOptionToken(option) { return option.required ? `<${option.name}>` : `[${option.name}]`; }
function dashboardCommandUsages(commandData) {
    const entries = [];
    const root = `/${commandData.name}`;
    const walk = (options, path, description) => {
        const nested = (options || []).filter(option => Number(option.type) === 1 || Number(option.type) === 2);
        if (nested.length) {
            for (const subcommand of nested)
                walk(subcommand.options || [], [...path, subcommand.name], subcommand.description || description);
            return;
        }
        const args = (options || []).filter(option => Number(option.type) !== 1 && Number(option.type) !== 2).map(dashboardOptionToken);
        entries.push({ syntax: `${path.join(' ')}${args.length ? ` ${args.join(' ')}` : ''}`, description: description || 'No additional description provided.' });
    };
    walk(commandData.options || [], [root], commandData.description || '');
    return entries;
}
function commandDashboardCatalog() { return slash.map(builder => { const item = builder.toJSON(); return { name: item.name, description: item.description || 'No description provided.', defaultMemberPermissions: item.default_member_permissions ?? null, usages: dashboardCommandUsages(item) }; }); }
async function handleCommand(interaction, client, ctx) {
    const name = interaction.commandName;
    const cfg = interaction.guildId ? (0, db_js_1.getGuildConfig)(interaction.guildId) : null;
    if (interaction.guildId && (0, core_js_1.isStaff)(interaction.member))
        (0, staff_activity_js_1.recordStaffCommand)(interaction.guildId, interaction.user.id);
    try {
        if (!interaction.guild && !['ping', 'botinfo', 'invite'].includes(name))
            return (0, core_js_1.safeReply)(interaction, { content: config_js_1.config.messages.guildOnly, ephemeral: true });
        if (interaction.guildId) {
            const accessFailure = commandAccessFailure(interaction, cfg, name);
            if (accessFailure)
                return (0, core_js_1.safeReply)(interaction, { content: accessFailure, ephemeral: true });
            const applicationAccessFailure = applicationCommandAccessFailure(interaction, cfg);
            if (applicationAccessFailure)
                return (0, core_js_1.safeReply)(interaction, { content: applicationAccessFailure, ephemeral: true });
            const reasonFailure = configuredReasonFailure(interaction, cfg, name);
            if (reasonFailure)
                return (0, core_js_1.safeReply)(interaction, { content: reasonFailure, ephemeral: true });
        }
        switch (name) {
            case 'setup': return setupCommand(interaction, cfg);
            case 'panel': return panelCommand(interaction, cfg);
            case 'help': return helpCommand(interaction);
            case 'tickets': return ticketsCommand(interaction);
            case 'staffactivity': return staffActivityCommand(interaction);
            case 'applications': {
                const sub = interaction.options.getSubcommand();
                if (sub === 'panel') {
                    const panelId = interaction.options.getString('panel') || 'default';
                    const message = await (0, applications_js_1.sendApplicationPanel)(interaction.channel, interaction.guildId, panelId);
                    return (0, core_js_1.safeReply)(interaction, { content: `Application panel **${panelId}** was sent to ${interaction.channel}. Open message: ${message.url}`, ephemeral: true });
                }
                if (sub === 'list') {
                    const rows = (0, applications_js_1.recentApplications)(interaction.guildId, interaction.options.getString('status') ?? 'all', 25);
                    const description = rows.length ? rows.map(r => `#${r.id} — <@${r.user_id}> — **${r.type}** — ${r.status}`).join('\n') : 'No applications found for the selected filter.';
                    return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: `Applications — ${rows.length} result(s)`, description, color: config_js_1.config.brand.info })], ephemeral: true });
                }
                const id = interaction.options.getInteger('id');
                const action = interaction.options.getString('action');
                const reviewed = await (0, applications_js_1.reviewApplication)(client, interaction.guildId, id, action, interaction.user, interaction.options.getString('reason') ?? '');
                const dmNote = ['accepted', 'rejected'].includes(action) ? ((0, db_js_1.getGuildConfig)(interaction.guildId).applicationDefaults?.dmOnDecision === false ? 'Applicant DM is disabled in server settings.' : reviewed.dmSent ? 'The applicant was notified by DM.' : 'The decision was saved, but the applicant DM could not be delivered (privacy settings may block it).') : 'The application is now marked as reviewing.';
                return (0, core_js_1.safeReply)(interaction, { content: `Application **#${id}** was updated to **${action}**.\n${dmNote}\nReason: ${interaction.options.getString('reason') || 'No reason provided.'}`, ephemeral: true });
            }
            case 'close': return ticketCloseCommand(interaction);
            case 'add': return (0, core_js_1.safeReply)(interaction, { content: (await (0, tickets_js_1.addTicketUser)(interaction.channel, interaction.options.getUser('user').id)) ? 'Member added.' : 'This is not an open ticket.', ephemeral: true });
            case 'remove': return (0, core_js_1.safeReply)(interaction, { content: (await (0, tickets_js_1.removeTicketUser)(interaction.channel, interaction.options.getUser('user').id)) ? 'Member removed.' : 'This is not an open ticket.', ephemeral: true });
            case 'picperms': return picPermsCommand(interaction, cfg);
            case 'stats': return ticketStats(interaction);
            case 'leaderboard': return ticketLeaderboardCommand(interaction);
            case 'warn': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'No reason provided.';
                const result = await (0, moderation_js_1.warn)(interaction, interaction.options.getMember('user'), reason);
                const count = (0, moderation_js_1.activeWarningCount)(interaction.guildId, user.id);
                const response = moderationResponse(cfg, 'warn', { user: String(user), username: user.username, userId: user.id, moderator: interaction.user.tag, reason, caseId: result.id, warningId: result.warningId, warningCount: result.count, activeWarnings: count, totalWarnings: (0, moderation_js_1.punishmentCount)(interaction.guildId, user.id, 'warn'), dmStatus: dmDeliveryLabel(result.dmSent), automaticAction: result.automaticAction || 'No automatic escalation action was triggered.' }, `Warning issued to {user}. Warning ID: #{warningId}. Case: #{caseId}. Reason: {reason}. Active warnings: {activeWarnings}. Member DM: {dmStatus}. {automaticAction}`);
                return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Warning issued successfully', description: response, color: config_js_1.config.brand.warning })], ephemeral: true });
            }
            case 'warnings': return warningsCommand(interaction);
            case 'unwarn': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const id = interaction.options.getInteger('warning_id');
                const removed = (0, moderation_js_1.removeWarning)(interaction.guildId, id);
                if (!removed)
                    throw new Error('No active warning with that ID was found in this server.');
                const reason = interaction.options.getString('reason') || `Warning #${id} was cleared by staff.`;
                (0, core_js_1.makeCase)(interaction.guildId, removed.user_id, interaction.user.id, 'WARNING_REMOVED', reason, null, null, { warningId: id });
                const target = await interaction.client.users.fetch(removed.user_id).catch(() => null);
                const dmSent = target ? await (0, core_js_1.dmTemplate)(target, interaction.guild, (0, db_js_1.getGuildConfig)(interaction.guildId).dmTemplates.warningRemoved, { reason, moderator: interaction.user.tag, warningId: id }) : false;
                const response = moderationResponse(cfg, 'unwarn', { user: `<@${removed.user_id}>`, userId: removed.user_id, moderator: interaction.user.tag, reason, warningId: id, dmStatus: dmDeliveryLabel(dmSent) }, `Warning #{warningId} for {user} was removed from the active list. Historical records were retained. Reason: {reason}. Member DM: {dmStatus}.`);
                return (0, core_js_1.safeReply)(interaction, { content: response, ephemeral: true });
            }
            case 'clearwarnings': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'Staff cleared the active warnings.';
                const count = (0, moderation_js_1.clearWarnings)(interaction.guildId, user.id);
                if (count)
                    (0, core_js_1.makeCase)(interaction.guildId, user.id, interaction.user.id, 'WARNINGS_CLEARED', reason, null, null, { clearedWarnings: count });
                const dmSent = count ? await (0, core_js_1.dmTemplate)(user, interaction.guild, (0, db_js_1.getGuildConfig)(interaction.guildId).dmTemplates.clearwarnings ?? (0, db_js_1.getGuildConfig)(interaction.guildId).dmTemplates.pardon, { reason, moderator: interaction.user.tag, warningCount: count }) : false;
                const response = count ? moderationResponse(cfg, 'clearwarnings', { user: String(user), username: user.username, userId: user.id, moderator: interaction.user.tag, reason, warningCount: count, dmStatus: dmDeliveryLabel(dmSent) }, `Cleared {warningCount} active warning(s) for {user}. Historical records were retained. Reason: {reason}. Member DM: {dmStatus}.`) : `${user} has no active warnings to clear; no changes or direct message were made.`;
                return (0, core_js_1.safeReply)(interaction, { content: response, ephemeral: true });
            }
            case 'punishmentstats': {
                const user = interaction.options.getUser('user');
                const stats = (0, moderation_js_1.punishmentStats)(interaction.guildId, user.id);
                return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: `Punishment History — ${user.username}`, description: `Recorded bans: **${stats.bans}**\nTemporary bans: **${stats.temporaryBans}**\nKicks: **${stats.kicks}**\nTimeouts: **${stats.timeouts}**\nWarnings issued: **${stats.warnings}**\nActive warnings: **${stats.activeWarnings}**\nJails: **${stats.jails}**\nTotal case records: **${stats.totalCases}**`, color: config_js_1.config.brand.info })], ephemeral: true });
            }
            case 'history': return historyCommand(interaction);
            case 'caselog': return caseLogCommand(interaction);
            case 'reason': {
                const ok = (0, core_js_1.updateCaseReason)(interaction.options.getInteger('id'), interaction.guildId, interaction.options.getString('new'));
                return (0, core_js_1.safeReply)(interaction, { content: ok ? 'Case updated.' : 'Case not found.', ephemeral: true });
            }
            case 'ban': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'No reason provided.';
                const result = await (0, moderation_js_1.ban)(interaction, interaction.options.getMember('user'), reason);
                const response = moderationResponse(cfg, 'ban', { user: String(user), username: user.username, userId: user.id, moderator: interaction.user.tag, reason, caseId: result.id, duration: 'Permanent', dmStatus: dmDeliveryLabel(result.dmSent), recordedPermanentBans: (0, moderation_js_1.punishmentCount)(interaction.guildId, user.id, 'ban') }, `{user} was permanently banned. Case: #{caseId}. Reason: {reason}. Member DM: {dmStatus}.`);
                return (0, core_js_1.safeReply)(interaction, { content: response, ephemeral: true });
            }
            case 'unban': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const userId = interaction.options.getString('user_id');
                const reason = interaction.options.getString('reason') || 'User unbanned by staff';
                const result = await (0, moderation_js_1.unban)(interaction.guild, userId, interaction.user.id, interaction, reason);
                const user = `<@${userId}>`;
                const response = moderationResponse(cfg, 'unban', { user, userId, moderator: interaction.user.tag, caseId: result.id, reason, dmStatus: dmDeliveryLabel(result.dmSent) }, `Ban removed for user {user} (ID {userId}). Case: #{caseId}. Reason: {reason}. Member DM: {dmStatus}.`);
                return (0, core_js_1.safeReply)(interaction, { content: response, ephemeral: true });
            }
            case 'banlist': {
                await (0, core_js_1.deferEphemeral)(interaction);
                return banlistCommand(interaction);
            }
            case 'tempban': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const user = interaction.options.getUser('user');
                const duration = interaction.options.getString('duration');
                const reason = interaction.options.getString('reason') || 'No reason provided.';
                const result = await (0, moderation_js_1.tempban)(interaction, interaction.options.getMember('user'), duration, reason);
                const expiresAt = Number(result.expiresAt || 0);
                const response = moderationResponse(cfg, 'tempban', { user: String(user), username: user.username, userId: user.id, moderator: interaction.user.tag, reason, caseId: result.id, duration: (0, core_js_1.formatDuration)(result.durationMs), expiresAt: timestampLabel(expiresAt), expiresRelative: expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:R>` : 'not recorded', dmStatus: dmDeliveryLabel(result.dmSent) }, `{user} was temporarily banned for {duration}. Case: #{caseId}. Expires: {expiresAt} ({expiresRelative}). Reason: {reason}. Member DM: {dmStatus}.`);
                return (0, core_js_1.safeReply)(interaction, { content: response, ephemeral: true });
            }
            case 'kick': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'No reason provided.';
                const result = await (0, moderation_js_1.kick)(interaction, interaction.options.getMember('user'), reason);
                const response = moderationResponse(cfg, 'kick', { user: String(user), username: user.username, userId: user.id, moderator: interaction.user.tag, reason, caseId: result.id, dmStatus: dmDeliveryLabel(result.dmSent), recordedKicks: (0, moderation_js_1.punishmentCount)(interaction.guildId, user.id, 'kick') }, `{user} was kicked. Case: #{caseId}. Reason: {reason}. Member DM: {dmStatus}.`);
                return (0, core_js_1.safeReply)(interaction, { content: response, ephemeral: true });
            }
            case 'kicklist': return kicklistCommand(interaction);
            case 'mute':
            case 'tempmute': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const user = interaction.options.getUser('user');
                const duration = interaction.options.getString('duration');
                const reason = interaction.options.getString('reason') || 'No reason provided.';
                const result = await (0, moderation_js_1.timeout)(interaction, interaction.options.getMember('user'), duration, reason);
                const expiresAt = Number(result.expiresAt || 0);
                const response = moderationResponse(cfg, 'mute', { user: String(user), username: user.username, userId: user.id, moderator: interaction.user.tag, reason, caseId: result.id, duration: (0, core_js_1.formatDuration)(result.durationMs), expiresAt: timestampLabel(expiresAt), expiresRelative: expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:R>` : 'not recorded', dmStatus: dmDeliveryLabel(result.dmSent) }, `{user} was timed out for {duration}. Case: #{caseId}. Expires: {expiresAt} ({expiresRelative}). Reason: {reason}. Member DM: {dmStatus}. Discord's maximum timeout is 28 days.`);
                return (0, core_js_1.safeReply)(interaction, { content: response, ephemeral: true });
            }
            case 'unmute': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const target = interaction.options.getMember('user');
                const reason = interaction.options.getString('reason') || 'Timeout removed by staff';
                const result = await (0, moderation_js_1.untimeout)(interaction, target, reason);
                const response = moderationResponse(cfg, 'unmute', { user: String(target.user), username: target.user.username, userId: target.id, moderator: interaction.user.tag, caseId: result.id, reason, dmStatus: dmDeliveryLabel(result.dmSent) }, `Timeout removed from {user}. Case: #{caseId}. Reason: {reason}. Member DM: {dmStatus}.`);
                return (0, core_js_1.safeReply)(interaction, { content: response, ephemeral: true });
            }
            case 'pardon': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'Staff cleared the active warnings.';
                const count = (0, moderation_js_1.clearWarnings)(interaction.guildId, user.id);
                if (count)
                    (0, core_js_1.makeCase)(interaction.guildId, user.id, interaction.user.id, 'PARDON', reason, null, null, { clearedWarnings: count });
                const dmSent = count ? await (0, core_js_1.dmTemplate)(user, interaction.guild, (0, db_js_1.getGuildConfig)(interaction.guildId).dmTemplates.clearwarnings ?? (0, db_js_1.getGuildConfig)(interaction.guildId).dmTemplates.pardon, { reason, moderator: interaction.user.tag, warningCount: count }) : false;
                const response = count ? moderationResponse(cfg, 'pardon', { user: String(user), username: user.username, userId: user.id, moderator: interaction.user.tag, reason, warningCount: count, dmStatus: dmDeliveryLabel(dmSent) }, `Pardon completed for {user}: cleared {warningCount} active warning(s). Historical records remain. Member DM: {dmStatus}.`) : `${user} has no active warnings, so no pardon changes were made.`;
                return (0, core_js_1.safeReply)(interaction, { content: response, ephemeral: true });
            }
            case 'untimeoutall': {
                const count = await (0, moderation_js_1.timeoutAll)(interaction.guild);
                return (0, core_js_1.safeReply)(interaction, { content: `Removed ${count} timeouts.`, ephemeral: true });
            }
            case 'purge': {
                const n = await (0, moderation_js_1.purge)(interaction.channel, interaction.options.getInteger('amount'));
                return (0, core_js_1.safeReply)(interaction, { content: `Deleted ${n} messages.`, ephemeral: true });
            }
            case 'cleanup': {
                const n = await (0, moderation_js_1.cleanup)(interaction.channel, interaction.options.getInteger('amount') ?? 100);
                return (0, core_js_1.safeReply)(interaction, { content: `Deleted ${n} bot/command messages.`, ephemeral: true });
            }
            case 'lockdown': {
                const ch = interaction.options.getChannel('channel') ?? interaction.channel;
                await (0, moderation_js_1.lockdownChannel)(ch, interaction.options.getString('reason') ?? 'Auralis lockdown');
                return (0, core_js_1.safeReply)(interaction, { content: `Locked ${ch}.`, ephemeral: true });
            }
            case 'unlock': {
                const ch = interaction.options.getChannel('channel') ?? interaction.channel;
                await (0, moderation_js_1.unlockChannel)(ch);
                return (0, core_js_1.safeReply)(interaction, { content: `Unlocked ${ch}.`, ephemeral: true });
            }
            case 'lockdownall': {
                let n = 0;
                for (const ch of interaction.guild.channels.cache.values())
                    if (ch.isTextBased() && !ch.isThread()) {
                        await (0, moderation_js_1.lockdownChannel)(ch).catch(() => { });
                        n++;
                    }
                return (0, core_js_1.safeReply)(interaction, { content: `Locked ${n} text channels.`, ephemeral: true });
            }
            case 'unlockdownall': {
                let n = 0;
                for (const ch of interaction.guild.channels.cache.values())
                    if (ch.isTextBased() && !ch.isThread()) {
                        await (0, moderation_js_1.unlockChannel)(ch).catch(() => { });
                        n++;
                    }
                return (0, core_js_1.safeReply)(interaction, { content: `Unlocked ${n} text channels.`, ephemeral: true });
            }
            case 'strip': {
                const reason = interaction.options.getString('reason') || 'Manageable roles removed.';
                const roles = await (0, moderation_js_1.stripMember)(interaction, interaction.options.getMember('user'), reason);
                if (!roles.length)
                    return (0, core_js_1.safeReply)(interaction, { content: `No roles were changed for ${interaction.options.getUser('user')}. Auralis could not find any assignable roles to remove, so no case was created.`, ephemeral: true });
                const id = (0, core_js_1.makeCase)(interaction.guildId, interaction.options.getUser('user').id, interaction.user.id, 'STRIP', reason);
                return (0, core_js_1.safeReply)(interaction, { content: `Removed ${roles.length} role(s) from ${interaction.options.getUser('user')}. Case #${id}. Reason: ${reason}`, ephemeral: true });
            }
            case 'jail': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'No reason provided.';
                const result = await (0, moderation_js_1.jailMember)(interaction, interaction.options.getMember('user'), reason);
                return (0, core_js_1.safeReply)(interaction, { content: `🔒 **Member jailed**\nMember: ${user}\nCase: **#${result.id}**\nReason: ${(0, core_js_1.truncate)(reason, 700)}\nDirect message: ${dmDeliveryLabel(result.dmSent)}.`, ephemeral: true });
            }
            case 'unjail': {
                await (0, core_js_1.deferEphemeral)(interaction);
                const target = interaction.options.getMember('user');
                const result = await (0, moderation_js_1.unjail)(interaction, target);
                return (0, core_js_1.safeReply)(interaction, { content: `🔓 **Member released from jail**\nMember: ${target.user}\nCase: **#${result.id}**\nRoles restored: **${result.rolesRestored}**${result.rolesSkipped ? `\nRoles skipped because they no longer exist or Auralis cannot assign them: **${result.rolesSkipped}**` : ''}\nDirect message: ${dmDeliveryLabel(result.dmSent)}.`, ephemeral: true });
            }
            case 'jailed': {
                const page = Math.max(1, interaction.options.getInteger('page') ?? 1);
                const per = 10;
                const rows = db_js_1.db.prepare('SELECT * FROM jailed_roles WHERE guild_id=? ORDER BY jailed_at DESC').all(interaction.guildId);
                const start = (page - 1) * per;
                const slice = rows.slice(start, start + per);
                return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Currently Jailed', description: slice.length ? slice.map((r, n) => `${start + n + 1}. <@${r.user_id}> — <t:${Math.floor(r.jailed_at / 1000)}:R>`).join('\n') : 'No one is currently jailed.', color: config_js_1.config.brand.warning })], ephemeral: true });
            }
            case 'setjail': return setJailCommand(interaction, cfg);
            case 'setjailauto': return (0, core_js_1.safeReply)(interaction, { content: 'Jail auto settings can be changed in `/setup` → Security.', ephemeral: true });
            case 'pin': return pinCommand(interaction, false);
            case 'unpin': return pinCommand(interaction, true);
            case 'hide': return visibilityCommand(interaction, false);
            case 'unhide': return visibilityCommand(interaction, true);
            case 'slowmode':
                await interaction.channel.setRateLimitPerUser(interaction.options.getInteger('secs'));
                return (0, core_js_1.safeReply)(interaction, { content: `Slowmode set to ${interaction.options.getInteger('secs')}s.`, ephemeral: true });
            case 'nsfw': {
                const ch = interaction.options.getChannel('channel') ?? interaction.channel;
                await ch.setNSFW(!ch.nsfw);
                return (0, core_js_1.safeReply)(interaction, { content: `NSFW ${ch.nsfw ? 'enabled' : 'disabled'}.`, ephemeral: true });
            }
            case 'audit': {
                const logs = await interaction.guild.fetchAuditLogs({ limit: interaction.options.getInteger('limit') ?? 10 });
                const desc = [...logs.entries.values()].map(e => `**${e.actionType}** — <@${e.executorId}> — ${new Date(e.createdTimestamp).toLocaleString()}`).join('\n') || 'No entries.';
                return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Audit log', description: desc, color: config_js_1.config.brand.neutral })], ephemeral: true });
            }
            case 'antinuke': return antinukeCommand(interaction, cfg);
            case 'level': return levelCommand(interaction, cfg);
            case 'autorole': return autoroleCommand(interaction);
            case 'reactionrole': return reactionRoleCommand(interaction, cfg);
            case 'buttonrole': return buttonRoleCommand(interaction);
            case 'boosterrole': return boosterRoleCommand(interaction, cfg);
            case 'tag': return tagCommand(interaction);
            case 'customcmd': return customCmdCommand(interaction);
            case 'sticky': return stickyCommand(interaction);
            case 'counter': return counterCommand(interaction);
            case 'imgonly': return imgOnlyCommand(interaction, cfg);
            case 'honeypot': return honeypotCommand(interaction, cfg);
            case 'verify': return verifyCommand(interaction, cfg);
            case 'suggest': return suggestCommand(interaction, cfg);
            case 'poll': return pollCommand(interaction);
            case 'giveaways': return giveawayCommand(interaction);
            case 'timezone': return timezoneCommand(interaction);
            case 'time': return timeCommand(interaction);
            case 'birthday': return birthdayCommand(interaction, cfg);
            case 'commands': {
                (0, db_js_1.setPrefixCommand)(interaction.guildId, interaction.options.getString('command').toLowerCase(), interaction.options.getBoolean('enabled'));
                return (0, core_js_1.safeReply)(interaction, { content: config_js_1.config.messages.saved, ephemeral: true });
            }
            case 'template': return templateCommand(interaction, cfg);
            case 'webhook': return webhookCommand(interaction);
            case 'embed': return embedCommand(interaction);
            case 'announce': return announceCommand(interaction);
            case 'serverinfo': return serverInfo(interaction);
            case 'userinfo': return userInfo(interaction);
            case 'channelinfo': return channelInfo(interaction);
            case 'roleinfo': return roleInfo(interaction);
            case 'avatar': return avatarCommand(interaction, false);
            case 'banner': return avatarCommand(interaction, true);
            case 'membercount': return memberCount(interaction);
            case 'roles': return assetList(interaction, 'roles');
            case 'emojis': return assetList(interaction, 'emojis');
            case 'stickers': return assetList(interaction, 'stickers');
            case 'inrole': return inRole(interaction);
            case 'newusers': return newUsers(interaction);
            case 'boomer': return boomer(interaction);
            case 'invite': return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Invite Auralis', description: `[Add Auralis to a server](${(0, ui_js_1.inviteUrl)(client.user.id)})` })], ephemeral: true });
            case 'inviteinfo': return inviteInfo(interaction);
            case 'invites': return invites(interaction);
            case 'translate': return translate(interaction);
            case 'crypto': return crypto(interaction);
            case 'color': return colorCommand(interaction);
            case 'randomhex': return randomHex(interaction);
            case 'remind': return remindCommand(interaction);
            case 'afk': return afkCommand(interaction);
            case 'ping': return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Auralis', description: `Pong — **${client.ws.ping}ms**`, color: config_js_1.config.brand.success })] });
            case 'botinfo': return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Auralis', description: `Support, moderation and community management.\nServers: **${client.guilds.cache.size}**\nUsers: **${client.guilds.cache.reduce((n, g) => n + g.memberCount, 0)}**`, color: config_js_1.config.brand.primary })] });
            case 'prefix': return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Server prefix', description: `\`${cfg.discord.defaultPrefix}\`` })] });
            case 'levelup': return levelRankCommand(interaction, cfg, interaction.options.getUser('user') ?? interaction.user);
            default: return (0, core_js_1.safeReply)(interaction, { content: 'Unknown command.', ephemeral: true });
        }
    }
    catch (error) {
        const detail = (0, core_js_1.cleanError)(error);
        console.warn(`[Auralis] /${name} failed: ${detail}`);
        const technical = /DiscordAPIError|SQLITE_|ECONN|ETIMEDOUT|TypeError|ReferenceError|SyntaxError|fetch failed|Cannot read properties/i.test(detail);
        const explanation = technical ? 'Auralis hit an internal error while handling this request. The issue has been logged; please try again shortly.' : (0, core_js_1.truncate)(detail, 700);
        const commandData = commandDefinitions.get(name)?.toJSON();
        const optionToken = option => option?.required ? `<${option.name}>` : `[${option.name}]`;
        const variants = [];
        for (const option of commandData?.options || []) {
            if (Number(option.type) === 1)
                variants.push(`/${name} ${option.name}${(option.options || []).filter(item => ![1, 2].includes(Number(item.type))).map(item => ` ${optionToken(item)}`).join('')}`);
            else if (Number(option.type) === 2)
                for (const child of option.options || [])
                    if (Number(child.type) === 1)
                        variants.push(`/${name} ${option.name} ${child.name}${(child.options || []).filter(item => ![1, 2].includes(Number(item.type))).map(item => ` ${optionToken(item)}`).join('')}`);
        }
        if (!variants.length && commandData)
            variants.push(`/${name}${(commandData.options || []).filter(item => ![1, 2].includes(Number(item.type))).map(item => ` ${optionToken(item)}`).join('')}`);
        const usage = variants.length ? `\n\n**Try this syntax**\n${variants.slice(0, 4).map(line => `\`${line}\``).join('\n')}${variants.length > 4 ? '\n…and more options are listed in `/help`.' : ''}` : '\n\nUse `/help` to view available command options.';
        return (0, core_js_1.safeReply)(interaction, { content: `I couldn’t complete \`/${name}\`. ${explanation}${usage}`, ephemeral: true }).catch(replyError => console.warn(`[Auralis] /${name} error response failed: ${(0, core_js_1.cleanError)(replyError)}`));
    }
}
function helpGroups() { return Object.keys(config_js_1.config.commandGroups); }
const HELP_COMMANDS_PER_PAGE = 20;
function helpOptionToken(option) {
    const name = String(option?.name || 'value').replace(/[^a-z0-9_-]/gi, '');
    return option?.required ? `<${name}>` : `[${name}]`;
}
function helpOptionDescription(option) {
    const name = String(option?.name || 'option').toLowerCase();
    const raw = String(option?.description || '').trim();
    const standard = {
        user: 'select the server member this action applies to',
        member: 'select the server member this action applies to',
        target: 'select the member or user this action applies to',
        reason: 'explain why you are taking this action; it is stored in the moderation history',
        duration: 'enter a duration such as 30m, 2h or 7d',
        warning_id: 'enter the ID of the active warning you want to remove',
        user_id: 'enter the Discord user ID, not a display name',
        channel: 'choose the text channel where the message or panel should be sent',
        role: 'choose the server role to add, remove or configure',
        message: 'enter the message text Auralis should send',
        title: 'enter the title shown at the top of the embed or panel',
        description: 'enter the text shown in the embed or panel',
        panel: 'enter the saved panel name or ID',
        page: 'choose the page number to display',
        amount: 'enter the number of messages or items to process',
        id: 'enter the ID of the case, panel or saved item',
        query: 'enter the words or subject you want Auralis to search for',
        song: 'enter the song title and, if known, the artist',
        question: 'enter the question you want to ask the server',
        options: 'enter the poll choices separated with the supported delimiter',
        prefix: 'enter the prefix to use in this server, such as . or !',
        name: 'enter a short name for the saved item',
        text: 'enter the text Auralis should use',
        color: 'enter a hex color such as #5865F2',
        type: 'choose the type of panel or action to use'
    };
    if (raw.length >= 18 && !/^(user|member|target|reason|duration|channel|role|message|name|text|id|page|amount|title|description|type|query|options|code|value|prefix)$/i.test(raw))
        return raw;
    return standard[name] || (raw ? `provide ${raw.toLowerCase()}` : `provide the ${name.replace(/[_-]/g, ' ')} for this command`);
}
function optionDetails(options = []) {
    const values = (Array.isArray(options) ? options : []).filter(option => ![1, 2].includes(Number(option?.type)));
    if (!values.length)
        return '';
    return values.map(option => `${helpOptionToken(option)}: ${helpOptionDescription(option)}`).join('; ');
}
function helpEntriesForGroup(group) {
    const names = Array.isArray(config_js_1.config.commandGroups?.[group]) ? config_js_1.config.commandGroups[group] : [];
    const prefixDefs = getPrefixCommandDefinitions();
    const entries = [];
    const seen = new Set();
    const addEntry = (usage, description) => {
        const cleanUsage = String(usage || '').trim();
        if (!cleanUsage || seen.has(cleanUsage))
            return;
        seen.add(cleanUsage);
        entries.push({ usage: cleanUsage, description: String(description || 'Command details are not available yet.').trim() });
    };
    for (const name of names) {
        const builder = commandDefinitions.get(name);
        const prefix = prefixDefs[name];
        if (group === 'prefix') {
            if (prefix)
                addEntry(prefix.usage || `.${name}`, prefix.help || `Use .${name} to run this prefix command.`);
            continue;
        }
        if (!builder) {
            if (prefix)
                addEntry(prefix.usage || `.${name}`, prefix.help || `Use .${name} to run this prefix command.`);
            else
                addEntry(`/${name}`, `Use /${name} to run this command.`);
            continue;
        }
        const json = builder.toJSON();
        const options = Array.isArray(json.options) ? json.options : [];
        const hasSubcommands = options.some(option => [1, 2].includes(Number(option?.type)));
        if (!hasSubcommands) {
            const args = options.filter(option => ![1, 2].includes(Number(option?.type))).map(helpOptionToken).join(' ');
            const details = optionDetails(options);
            addEntry(`/${json.name}${args ? ` ${args}` : ''}`, `${json.description || `Run /${json.name}.`}${details ? ` Inputs: ${details}` : ''}`);
            continue;
        }
        for (const option of options) {
            if (Number(option?.type) === 1) {
                const args = (option.options || []).map(helpOptionToken).join(' ');
                const details = optionDetails(option.options || []);
                addEntry(`/${json.name} ${option.name}${args ? ` ${args}` : ''}`, `${option.description || json.description || 'Run this command action.'}${details ? ` Inputs: ${details}` : ''}`);
            }
            else if (Number(option?.type) === 2) {
                for (const child of (option.options || []).filter(item => Number(item?.type) === 1)) {
                    const args = (child.options || []).map(helpOptionToken).join(' ');
                    const details = optionDetails(child.options || []);
                    addEntry(`/${json.name} ${option.name} ${child.name}${args ? ` ${args}` : ''}`, `${child.description || option.description || json.description || 'Run this command action.'}${details ? ` Inputs: ${details}` : ''}`);
                }
            }
        }
    }
    return entries;
}
function helpEmbed(group, page = 1) {
    const groups = helpGroups();
    const normalized = groups.includes(group) ? group : groups[0];
    const entries = helpEntriesForGroup(normalized);
    const totalPages = Math.max(1, Math.ceil(entries.length / HELP_COMMANDS_PER_PAGE));
    const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const slice = entries.slice((current - 1) * HELP_COMMANDS_PER_PAGE, current * HELP_COMMANDS_PER_PAGE);
    const descriptionLines = slice.map(entry => {
        const plain = (0, core_js_1.truncate)(`${entry.usage} — ${entry.description}`.replace(/[\r\n]+/g, ' '), 180);
        const separator = plain.indexOf(' — ');
        return separator > 0
            ? `• \`${plain.slice(0, separator)}\` — ${plain.slice(separator + 3)}`
            : `• \`${plain}\``;
    });
    const color = normalized === 'moderation'
        ? config_js_1.config.brand.danger
        : normalized === 'security'
            ? config_js_1.config.brand.warning
            : normalized === 'support'
                ? config_js_1.config.brand.success
                : config_js_1.config.brand.primary;
    const text = `One command per line. Required values use <angle brackets>; optional values use [square brackets]. Prefix commands use this server's configured prefix.\n\n${descriptionLines.join('\n')}\n\nPage **${current} / ${totalPages}**`;
    return (0, core_js_1.makeEmbed)({ title: `Auralis ${(0, core_js_1.titleCase)(normalized)} Help`, description: (0, core_js_1.truncate)(text, 4000), color });
}
function helpComponents(group, page) {
    const groups = helpGroups();
    const names = helpEntriesForGroup(group);
    const totalPages = Math.max(1, Math.ceil(names.length / HELP_COMMANDS_PER_PAGE));
    const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const select = new discord_js_1.StringSelectMenuBuilder().setCustomId('help:category').setPlaceholder('Choose a command category').addOptions(groups.map(value => ({ label: (0, core_js_1.titleCase)(value), value, description: `Browse ${helpEntriesForGroup(value).length} commands` })));
    const nav = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`help:prev:${group}:${current}`).setLabel('Previous').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(current <= 1), new discord_js_1.ButtonBuilder().setCustomId(`help:page:${group}:${current}`).setLabel(`Page ${current} / ${totalPages}`).setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(true), new discord_js_1.ButtonBuilder().setCustomId(`help:next:${group}:${current}`).setLabel('Next').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(current >= totalPages));
    return [new discord_js_1.ActionRowBuilder().addComponents(select), nav];
}
async function helpCommand(interaction) {
    const requested = interaction.options.getString('category');
    const group = helpGroups().includes(requested) ? requested : helpGroups()[0];
    const page = interaction.options.getInteger('page') || 1;
    return (0, core_js_1.safeReply)(interaction, { embeds: [helpEmbed(group, page)], components: helpComponents(group, page), ephemeral: true });
}
async function staffActivityCommand(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'panel') {
        const cfg = (0, db_js_1.getGuildConfig)(interaction.guildId);
        const channelId = interaction.options.getChannel('channel')?.id ?? cfg.staffActivityDefaults?.channelId;
        if (channelId)
            cfg.staffActivityDefaults.channelId = channelId;
        (0, db_js_1.saveGuildConfig)(interaction.guildId, cfg);
        return (0, staff_activity_js_1.sendStaffActivityPanel)(interaction);
    }
    if (sub === 'check') {
        const target = interaction.options.getMember('user') ?? interaction.member;
        if (!target || !(0, core_js_1.isStaff)(target))
            throw new Error('The selected member is not a staff member.');
        return (0, staff_activity_js_1.showStaffActivity)(interaction, target);
    }
    const page = interaction.options.getInteger('page') ?? 1;
    const slice = (0, staff_activity_js_1.staffActivityLeaderboard)(interaction.guildId, page);
    const description = slice.items.map((row, index) => {
        const rank = (slice.page - 1) * 10 + index + 1;
        const total = Number(row.command_count || 0) + Number(row.moderation_actions || 0) + Number(row.ticket_closes || 0);
        return `**${rank}.** <@${row.user_id}>\n${total} actions — ${row.ticket_closes || 0} ticket closes — ${row.moderation_actions || 0} moderation actions`;
    }).join('\n\n') || 'No staff activity has been recorded yet.';
    return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: `Staff Activity Leaderboard`, description: `${description}\n\nPage **${slice.page} / ${slice.totalPages}**`, color: config_js_1.config.brand.primary })], ephemeral: true });
}
async function panelCommand(interaction, cfg) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'send')
        throw new Error('Choose `/panel send` and select a panel type.');
    await (0, core_js_1.deferEphemeral)(interaction);
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    if (!channel?.isTextBased?.() || !channel.guild || channel.guild.id !== interaction.guildId)
        throw new Error('Choose a text or announcement channel in this server.');
    let message;
    if (type === 'ticket') {
        const panelId = interaction.options.getString('panel') || 'default';
        const panel = (0, tickets_js_1.getTicketPanel)(interaction.guildId, panelId);
        if (!panel)
            throw new Error(`Ticket panel \`${panelId}\` was not found. Create it in Dashboard → Ticket Panels first.`);
        message = await (0, tickets_js_1.sendTicketPanel)(channel, interaction.guildId, panel.id);
        return (0, core_js_1.safeReply)(interaction, { content: `Ticket panel **${panel.name || panel.id}** was sent to ${channel}: ${message.url}`, ephemeral: true });
    }
    if (type === 'application') {
        message = await (0, applications_js_1.sendApplicationPanel)(channel, interaction.guildId);
        return (0, core_js_1.safeReply)(interaction, { content: `Application panel was sent to ${channel}: ${message.url}`, ephemeral: true });
    }
    if (type === 'staffactivity') {
        const check = await (0, staff_activity_js_1.sendStaffActivityPanelToChannel)(interaction.guild, channel);
        return (0, core_js_1.safeReply)(interaction, { content: `Staff activity check was sent to ${channel}: https://discord.com/channels/${interaction.guildId}/${channel.id}/${check.message_id}`, ephemeral: true });
    }
    if (type === 'verification') {
        if (!cfg.verifyDefaults?.roleId || !interaction.guild.roles.cache.has(String(cfg.verifyDefaults.roleId)))
            throw new Error('Verification is not configured yet. Configure a verification role in Dashboard → Security or use `/verify setup` first.');
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('verify').setLabel(String(cfg.verifyDefaults.buttonLabel || 'Verify')).setStyle(discord_js_1.ButtonStyle.Success));
        message = await channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: cfg.verifyDefaults.title || 'Verify', description: cfg.verifyDefaults.message || 'Click below to receive the verified role.', color: config_js_1.config.brand.success })], components: [row] });
        cfg.verifyDefaults.enabled = true;
        cfg.verifyDefaults.channelId = channel.id;
        (0, db_js_1.saveGuildConfig)(interaction.guildId, cfg);
        return (0, core_js_1.safeReply)(interaction, { content: `Verification panel was sent to ${channel}: ${message.url}`, ephemeral: true });
    }
    if (type === 'setup') {
        const embed = (0, core_js_1.makeEmbed)({ title: 'Auralis Setup', description: 'Configure modules, welcome messages, moderation, AutoMod, tickets and logs. Select a section below; changes are stored separately for this server.', color: config_js_1.config.brand.primary });
        message = await channel.send({ embeds: [embed], components: (0, ui_js_1.setupMainComponents)() });
        return (0, core_js_1.safeReply)(interaction, { content: `Auralis setup menu was sent to ${channel}: ${message.url}`, ephemeral: true });
    }
    throw new Error('Unknown panel type.');
}
async function setupCommand(interaction, cfg) {
    const embed = (0, core_js_1.makeEmbed)({ title: 'Auralis Setup', description: 'Configure your server without leaving Discord.\n\nChoose a section below. Changes are stored per server.', color: config_js_1.config.brand.primary, fields: [{ name: 'Basic', value: 'Welcome, goodbye, prefix and autoroles.', inline: true }, { name: 'Auto Mod', value: 'Filters, anti-link, spam and triggers.', inline: true }, { name: 'Logs', value: 'Choose a channel per event.', inline: true }, { name: 'Levels', value: 'XP, rewards and announcements.', inline: true }, { name: 'Tickets', value: 'Panel, categories and staff.', inline: true }, { name: 'Applications', value: 'Forms and review settings.', inline: true }] });
    return (0, core_js_1.safeReply)(interaction, { embeds: [embed], components: (0, ui_js_1.setupMainComponents)() });
}
async function ticketsCommand(interaction) { const sub = interaction.options.getSubcommand(); if (sub === 'panel') {
    const panelName = interaction.options.getString('panel');
    const panel = (0, tickets_js_1.getTicketPanel)(interaction.guildId, panelName || 'default');
    if (!panel)
        throw new Error('Ticket panel not found.');
    const sent = await (0, tickets_js_1.sendTicketPanel)(interaction.channel, interaction.guildId, panel.id);
    return (0, core_js_1.safeReply)(interaction, { content: `Panel sent: ${sent.url}`, ephemeral: true });
} if (sub === 'list')
    return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Open Tickets', description: ((0, tickets_js_1.openTickets)(interaction.guildId).map(t => `<#${t.channel_id}> — ${t.type} — <@${t.opener_id}>`).join('\n') || 'No open tickets.') })], ephemeral: true }); if (sub === 'stats' || sub === 'leaderboard')
    return ticketLeaderboardCommand(interaction); return ticketStats(interaction); }
async function ticketCloseCommand(interaction) { await (0, core_js_1.deferEphemeral)(interaction); const r = await (0, tickets_js_1.closeTicket)(interaction.channel, interaction.member, interaction.client); return (0, core_js_1.safeReply)(interaction, { content: r.ok ? `Ticket closed. ${r.dmSent ? 'The ticket owner was sent a direct message.' : r.dmEnabled ? 'The ticket owner could not be sent a direct message; their privacy settings may block DMs.' : 'Ticket-close DMs are disabled for this server.'}` : r.message, ephemeral: true }); }
async function ticketStats(interaction) { const count = db_js_1.db.prepare('SELECT COUNT(*) AS c FROM tickets WHERE guild_id=?').get(interaction.guildId).c; const open = db_js_1.db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE guild_id=? AND status='open'").get(interaction.guildId).c; return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Ticket Statistics', description: `Total: **${count}**\nOpen: **${open}**`, color: config_js_1.config.brand.info })], ephemeral: true }); }
async function ticketLeaderboardCommand(interaction) { const rows = (0, tickets_js_1.ticketLeaderboard)(interaction.guildId); return (0, core_js_1.safeReply)(interaction, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Ticket Leaderboard', description: rows.map((r, i) => `${i + 1}. <@${r.user_id}> — **${r.closes}** closes`).join('\n') || 'No closes yet.', color: config_js_1.config.brand.primary })], ephemeral: true }); }
async function picPermsCommand(interaction, cfg) { let roleId = cfg.picPermsRoleId; if (!roleId)
    throw new Error('Configure `picPermsRoleId` in `/setup`.'); const member = interaction.options.getMember('user'); const role = interaction.guild.roles.cache.get(roleId); if (!role)
    throw new Error('Pic-perms role was not found.'); if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role);
    return (0, core_js_1.safeReply)(interaction, { content: 'Pic-perms removed.', ephemeral: true });
} await member.roles.add(role); return (0, core_js_1.safeReply)(interaction, { content: 'Pic-perms enabled.', ephemeral: true }); }
async function warningsCommand(i) { const rows = (0, moderation_js_1.warnings)(i.guildId, i.options.getUser('user').id); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Warnings', description: rows.map(r => `#${r.id} — <t:${Math.floor(r.created_at / 1000)}:R> — <@${r.moderator_id}>\n  ${r.reason}`).join('\n') || 'No active warnings.', color: config_js_1.config.brand.warning })], ephemeral: true }); }
async function historyCommand(i) { const rows = (0, moderation_js_1.history)(i.guildId, i.options.getUser('user').id); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Case History', description: rows.slice(0, 25).map(r => `**#${r.id}** — ${r.type} — <t:${Math.floor(r.created_at / 1000)}:R>\n${(0, core_js_1.truncate)(r.reason, 180)}`).join('\n\n') || 'No cases.', color: config_js_1.config.brand.neutral })], ephemeral: true }); }
async function caseLogCommand(i) { const r = (0, moderation_js_1.caseLog)(i.options.getInteger('id'), i.guildId); if (!r)
    return (0, core_js_1.safeReply)(i, { content: 'Case not found.', ephemeral: true }); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: `Case #${r.id}`, description: `Type: **${r.type}**\nUser: <@${r.user_id}>\nModerator: <@${r.moderator_id}>\nReason: ${r.reason}\nCreated: <t:${Math.floor(r.created_at / 1000)}:F>`, color: r.type.includes('BAN') ? config_js_1.config.brand.danger : config_js_1.config.brand.info })], ephemeral: true }); }
async function banlistCommand(i) {
    if (!i.memberPermissions?.has(discord_js_1.PermissionFlagsBits.BanMembers) && !i.memberPermissions?.has(discord_js_1.PermissionFlagsBits.Administrator) && i.guild.ownerId !== i.user.id)
        throw new Error('You need Ban Members or Administrator permission to view the current ban list.');
    let bans;
    try {
        bans = await i.guild.bans.fetch({ limit: 1000 });
    }
    catch (error) {
        throw new Error(`Auralis could not fetch the current Discord ban list: ${(0, core_js_1.cleanError)(error)}. Check the bot's Ban Members permission.`);
    }
    const caseRows = (0, moderation_js_1.banlistFromCases)(i.guildId);
    const latestByUser = new Map();
    for (const row of caseRows) {
        if (!latestByUser.has(String(row.user_id)))
            latestByUser.set(String(row.user_id), row);
    }
    const rows = [...bans.values()].map(ban => {
        const userId = String(ban.user.id);
        const record = latestByUser.get(userId);
        const type = record?.type === 'TEMPBAN' && Number(record.expires_at || 0) > Date.now() ? 'TEMPBAN' : 'BAN';
        const expiry = type === 'TEMPBAN' ? Number(record.expires_at) : null;
        const reason = ban.reason || record?.reason || 'No reason was recorded.';
        return { id: record?.id ?? '—', user_id: userId, type, created_at: Number(record?.created_at ?? ban.user.createdTimestamp ?? Date.now()), expires_at: expiry, reason };
    }).sort((a, b) => Number(b.created_at) - Number(a.created_at));
    const page = i.options.getInteger('page') ?? 1;
    const s = (0, core_js_1.pageSlice)(rows, page, 10);
    const description = s.items.map(r => `**#${r.id}** — <@${r.user_id}> — ${r.type === 'TEMPBAN' && r.expires_at ? `Temporary · expires <t:${Math.floor(r.expires_at / 1000)}:F>` : 'Permanent / active'}\n  ${(0, core_js_1.truncate)(r.reason, 120)}`).join('\n') || 'There are currently no banned users in this server.';
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: `Current Ban List — ${s.page}/${s.totalPages}`, description: `Currently banned: **${rows.length}**\n\n${description}`, color: config_js_1.config.brand.danger, footer: `Only live bans are listed. Discord API returns at most 1,000 entries in this request.` })], ephemeral: true });
}
async function kicklistCommand(i) { const rows = (0, moderation_js_1.recentKicks)(i.guildId, 50); const s = (0, core_js_1.pageSlice)(rows, i.options.getInteger('page') ?? 1, 10); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: `Kick List — ${s.page}/${s.totalPages}`, description: s.items.map(r => `**#${r.id}** — <@${r.user_id}> — ${(0, core_js_1.relativeTime)(r.created_at)}\n  ${(0, core_js_1.truncate)(r.reason, 120)}`).join('\n') || 'No kicks logged.', color: config_js_1.config.brand.warning })], ephemeral: true }); }
async function selfPurge(i) { const amount = i.options.getInteger('amount') ?? 20; const messages = await i.channel.messages.fetch({ limit: 100 }); const mine = messages.filter(m => m.author.id === i.user.id).first(amount); let n = 0; for (const m of mine) {
    await m.delete().catch(() => { });
    n++;
} return (0, core_js_1.safeReply)(i, { content: `Deleted ${n} of your messages.`, ephemeral: true }); }
async function setJailCommand(i, cfg) { cfg.jailDefaults.roleId = i.options.getRole('role').id; const ch = i.options.getChannel('channel'); if (ch)
    cfg.jailDefaults.channelId = ch.id; (0, db_js_1.saveGuildConfig)(i.guildId, cfg); return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true }); }
async function pinCommand(i, unpin) { const match = i.options.getString('link').match(/channels\/\d+\/\d+\/(\d+)/); if (!match)
    throw new Error('Invalid Discord message link.'); const msg = await i.channel.messages.fetch(match[1]); unpin ? await msg.unpin() : await msg.pin(); return (0, core_js_1.safeReply)(i, { content: unpin ? 'Unpinned.' : 'Pinned.', ephemeral: true }); }
async function visibilityCommand(i, reveal) { const ch = i.options.getChannel('channel') ?? i.channel; const role = i.options.getRole('role'); const user = i.options.getUser('user'); const target = role ?? user; if (!target)
    throw new Error('Choose a role or user.'); await ch.permissionOverwrites.edit(target.id, { ViewChannel: reveal ? true : false }); return (0, core_js_1.safeReply)(i, { content: reveal ? 'Channel revealed.' : 'Channel hidden.', ephemeral: true }); }
async function antinukeCommand(i, cfg) { const sub = i.options.getSubcommand(); if (sub === 'status')
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Anti-Nuke', description: `Enabled: **${cfg.antinuke.enabled ? 'Yes' : 'No'}**\nModules: ${Object.entries(cfg.antinuke.modules).map(([k, v]) => `${k}: ${v ? 'on' : 'off'}`).join(' — ')}\nWhitelist: ${(cfg.antinuke.whitelist ?? []).length}`, color: config_js_1.config.brand.info })], ephemeral: true }); if (sub === 'toggle') {
    const key = i.options.getString('module');
    const map = { 'bot-add': 'botAdd' };
    const p = map[key] ?? key;
    if (!(p in cfg.antinuke.modules))
        throw new Error('Unknown module.');
    cfg.antinuke.modules[p] = !cfg.antinuke.modules[p];
    (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
    return (0, core_js_1.safeReply)(i, { content: `${key}: ${cfg.antinuke.modules[p] ? 'on' : 'off'}`, ephemeral: true });
} const u = i.options.getUser('user'); sub === 'whitelist_add' ? (0, security_js_1.addAntinukeWhitelist)(i.guildId, u.id) : (0, security_js_1.removeAntinukeWhitelist)(i.guildId, u.id); return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true }); }
async function levelCommand(i, cfg) { const sub = i.options.getSubcommand(); if (sub === 'rank')
    return levelRankCommand(i, cfg, i.options.getUser('user') ?? i.user); if (sub === 'leaderboard') {
    const rows = (0, community_js_1.levelLeaderboard)(i.guildId);
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Level Leaderboard', description: rows.map((r, n) => `${n + 1}. <@${r.user_id}> — Level **${r.level}** — **${r.xp} XP**`).join('\n') || 'No XP yet.', color: config_js_1.config.brand.primary })] });
} if (!(0, core_js_1.isAdmin)(i.member))
    throw new Error(config_js_1.config.messages.adminOnly); if (['enable', 'disable'].includes(sub)) {
    cfg.levelDefaults.enabled = sub === 'enable';
    (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
    return (0, core_js_1.safeReply)(i, { content: `Levels ${cfg.levelDefaults.enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
} if (sub === 'addrole') {
    const level = i.options.getInteger('level'), role = i.options.getRole('role');
    db_js_1.db.prepare('INSERT OR REPLACE INTO level_rewards(guild_id,level,role_id) VALUES(?,?,?)').run(i.guildId, level, role.id);
    cfg.levelDefaults.rewards[level] = role.id;
    (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'removerole') {
    db_js_1.db.prepare('DELETE FROM level_rewards WHERE guild_id=? AND level=?').run(i.guildId, i.options.getInteger('level'));
    delete cfg.levelDefaults.rewards[i.options.getInteger('level')];
    (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'listroles') {
    const rows = db_js_1.db.prepare('SELECT * FROM level_rewards WHERE guild_id=? ORDER BY level').all(i.guildId);
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Level Rewards', description: rows.map(r => `Level ${r.level}: <@&${r.role_id}>`).join('\n') || 'None configured.' })], ephemeral: true });
} if (sub === 'stack') {
    cfg.levelDefaults.stackRoles = i.options.getBoolean('enabled');
    (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'announce') {
    cfg.levelDefaults.announceChannelId = i.options.getChannel('channel')?.id ?? null;
    (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'setxp') {
    (0, community_js_1.setXp)(i.guildId, i.options.getUser('user').id, i.options.getInteger('xp'), cfg);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'setlevel') {
    (0, community_js_1.setLevel)(i.guildId, i.options.getUser('user').id, i.options.getInteger('level'), cfg);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'reset') {
    (0, community_js_1.resetLevel)(i.guildId, i.options.getUser('user').id);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'sync') {
    for (const member of i.guild.members.cache.values()) {
        const row = (0, community_js_1.levelData)(i.guildId, member.id);
        const roles = db_js_1.db.prepare('SELECT * FROM level_rewards WHERE guild_id=? AND level<=? ORDER BY level').all(i.guildId, row.level);
        if (cfg.levelDefaults.stackRoles) {
            for (const rr of roles) {
                const role = i.guild.roles.cache.get(rr.role_id);
                if (role && member.manageable)
                    await member.roles.add(role).catch(() => { });
            }
        }
    }
    return (0, core_js_1.safeReply)(i, { content: 'Level rewards re-applied.', ephemeral: true });
} }
async function levelRankCommand(i, cfg, user) { const row = (0, community_js_1.levelData)(i.guildId, user.id); const currentBase = cfg.levelDefaults.levelFormulaBase, currentMult = cfg.levelDefaults.levelFormulaMultiplier; const curNeed = row.level * currentBase + currentMult * ((row.level - 1) * row.level / 2); const nextNeed = (row.level + 1) * currentBase + currentMult * (row.level * (row.level + 1) / 2); const prevNeed = Math.max(0, curNeed); const bar = (0, core_js_1.colorBar)(Math.max(0, row.xp - prevNeed), Math.max(1, nextNeed - prevNeed)); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: `${user.username} — Level ${row.level}`, description: `**${row.xp} XP**\n${bar}\n\nNext level: **${Math.max(0, nextNeed - row.xp)} XP**`, color: config_js_1.config.brand.primary, thumbnail: user.displayAvatarURL() })] }); }
async function autoroleCommand(i) { const sub = i.options.getSubcommand(); if (sub === 'list') {
    const roles = (0, community_js_1.listAutoroles)(i.guildId);
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Configured auto-roles', description: roles.map(id => `• <@&${id}>`).join('\n') || 'No auto-roles are configured. Use `/autorole add` to add one.', color: config_js_1.config.brand.info })], ephemeral: true });
} if (sub === 'add') {
    const role = i.options.getRole('role');
    const already = (0, community_js_1.listAutoroles)(i.guildId).includes(role.id);
    (0, community_js_1.addAutorole)(i.guildId, role.id);
    return (0, core_js_1.safeReply)(i, { content: already ? `${role} is already an auto-role; no duplicate entry was created.` : `Added ${role} as an auto-role. New members will receive this role when they join, provided Auralis has Manage Roles and its highest role is above this role. Use \`/autorole remove role:${role.name}\` to undo this setting.`, ephemeral: true });
} if (sub === 'remove') {
    const role = i.options.getRole('role');
    const existed = (0, community_js_1.listAutoroles)(i.guildId).includes(role.id);
    (0, community_js_1.removeAutorole)(i.guildId, role.id);
    return (0, core_js_1.safeReply)(i, { content: existed ? `Removed ${role} from the auto-role list. New members will no longer receive it automatically; existing members keep the role until staff remove it separately.` : `${role} was not in the auto-role list, so nothing needed to be changed.`, ephemeral: true });
} if (sub === 'reset') {
    if (!(0, core_js_1.isAdmin)(i.member) && i.guild.ownerId !== i.user.id)
        throw new Error(config_js_1.config.messages.adminOnly);
    const count = (0, community_js_1.listAutoroles)(i.guildId).length;
    (0, community_js_1.resetAutoroles)(i.guildId);
    return (0, core_js_1.safeReply)(i, { content: `Removed ${count} auto-role rule(s). Existing role assignments were not changed.`, ephemeral: true });
} }
async function reactionRoleCommand(i, cfg) { const sub = i.options.getSubcommand(); if (sub === 'add') {
    const emoji = i.options.getString('emoji');
    if (!(0, core_js_1.safeComponentEmoji)(emoji))
        throw new Error('Invalid emoji. Use a standard Unicode emoji or a custom Discord emoji.');
    (0, reactions_js_1.addReactionRole)(i.guildId, i.options.getString('msg'), emoji, i.options.getRole('role').id, i.channelId);
    const msg = await i.channel.messages.fetch(i.options.getString('msg'));
    await msg.react(i.options.getString('emoji')).catch(() => { });
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'remove') {
    (0, reactions_js_1.removeReactionRole)(i.guildId, i.options.getString('msg'), i.options.getString('emoji'));
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'removeall') {
    (0, reactions_js_1.removeAllReactionRoles)(i.guildId, i.options.getString('msg'));
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'list') {
    const rows = (0, reactions_js_1.reactionRoles)(i.guildId);
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Reaction Roles', description: rows.map(r => `${r.emoji} → <@&${r.role_id}> — ${r.message_id}`).join('\n') || 'None configured.' })], ephemeral: true });
} if (sub === 'reset') {
    db_js_1.db.prepare('DELETE FROM reaction_roles WHERE guild_id=?').run(i.guildId);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} cfg.reactionRoleDefaults.restoreOnRejoin = i.options.getBoolean('enabled'); (0, db_js_1.saveGuildConfig)(i.guildId, cfg); return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true }); }
async function buttonRoleCommand(i) { const sub = i.options.getSubcommand(); const msgId = i.options.getString('msg'); if (sub === 'add') {
    const rows = (0, reactions_js_1.buttonRoles)(i.guildId, msgId);
    const index = rows.length;
    const emoji = i.options.getString('emoji');
    if (emoji && !(0, core_js_1.safeComponentEmoji)(emoji))
        throw new Error('Invalid emoji. Use a standard Unicode emoji or a custom Discord emoji.');
    (0, reactions_js_1.addButtonRole)(i.guildId, msgId, index, i.options.getRole('role').id, i.options.getString('style') ?? 'Secondary', emoji, i.options.getString('label') ?? 'Role');
    await rebuildButtonRoles(i, msgId);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'remove') {
    (0, reactions_js_1.removeButtonRole)(i.guildId, msgId, i.options.getInteger('index'));
    await rebuildButtonRoles(i, msgId);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'removeall') {
    (0, reactions_js_1.removeAllButtonRoles)(i.guildId, msgId);
    await rebuildButtonRoles(i, msgId);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'list') {
    const rows = (0, reactions_js_1.buttonRoles)(i.guildId, msgId);
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Button Roles', description: rows.map(r => `${r.component_index}. ${r.label} → <@&${r.role_id}>`).join('\n') || 'None configured.' })], ephemeral: true });
} if (sub === 'reset') {
    db_js_1.db.prepare('DELETE FROM button_roles WHERE guild_id=?').run(i.guildId);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} }
async function rebuildButtonRoles(i, msgId) { const msg = await i.channel.messages.fetch(msgId); const rows = (0, reactions_js_1.buttonRoles)(i.guildId, msgId); const components = rows.slice(0, 5).map(r => { const b = new discord_js_1.ButtonBuilder().setCustomId(`rolebtn:${msgId}:${r.component_index}`).setStyle(discord_js_1.ButtonStyle[r.style] ?? discord_js_1.ButtonStyle.Secondary).setLabel(r.label ?? 'Role'); const emoji = (0, core_js_1.safeComponentEmoji)(r.emoji); if (emoji)
    b.setEmoji(emoji); return b; }); const row = components.length ? new discord_js_1.ActionRowBuilder().addComponents(components) : null; await msg.edit({ components: row ? [row] : [] }); }
async function boosterRoleCommand(i, cfg) { if (!cfg.boosterRoleDefaults.enabled)
    throw new Error('Booster roles are disabled.'); const sub = i.options.getSubcommand(); const record = db_js_1.db.prepare('SELECT * FROM booster_roles WHERE guild_id=? AND user_id=?').get(i.guildId, i.user.id); if (['color', 'rename', 'remove'].includes(sub)) {
    if (!record) {
        if (sub === 'remove')
            throw new Error('You do not have a booster role.');
    }
} if (sub === 'color') {
    const role = record ? i.guild.roles.cache.get(record.role_id) : await i.guild.roles.create({ name: `${i.user.username}'s Role`, color: (0, community_js_1.parseColorHex)(i.options.getString('hex')), reason: 'Auralis booster role' });
    if (record)
        await role.setColor((0, community_js_1.parseColorHex)(i.options.getString('hex')));
    else
        db_js_1.db.prepare('INSERT INTO booster_roles(guild_id,user_id,role_id) VALUES(?,?,?)').run(i.guildId, i.user.id, role.id);
    await i.member.roles.add(role);
    return (0, core_js_1.safeReply)(i, { content: 'Booster role updated.', ephemeral: true });
} if (sub === 'rename') {
    const role = i.guild.roles.cache.get(record.role_id);
    await role.setName(i.options.getString('name'));
    return (0, core_js_1.safeReply)(i, { content: 'Booster role renamed.', ephemeral: true });
} if (sub === 'remove') {
    const role = i.guild.roles.cache.get(record.role_id);
    await role?.delete().catch(() => { });
    db_js_1.db.prepare('DELETE FROM booster_roles WHERE guild_id=? AND user_id=?').run(i.guildId, i.user.id);
    return (0, core_js_1.safeReply)(i, { content: 'Booster role removed.', ephemeral: true });
} if (sub === 'setbase') {
    cfg.boosterRoleDefaults.baseRoleId = i.options.getRole('role').id;
    (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'limit') {
    cfg.boosterRoleDefaults.limit = i.options.getInteger('number');
    (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (['disable', 'enable'].includes(sub)) {
    cfg.boosterRoleDefaults.enabled = sub === 'enable';
    (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'list') {
    const rows = db_js_1.db.prepare('SELECT * FROM booster_roles WHERE guild_id=?').all(i.guildId);
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Booster Roles', description: rows.map(r => `<@${r.user_id}> → <@&${r.role_id}>`).join('\n') || 'None.' })], ephemeral: true });
} if (sub === 'cleanup') {
    for (const r of db_js_1.db.prepare('SELECT * FROM booster_roles WHERE guild_id=?').all(i.guildId)) {
        if (!i.guild.roles.cache.has(r.role_id))
            db_js_1.db.prepare('DELETE FROM booster_roles WHERE guild_id=? AND user_id=?').run(i.guildId, r.user_id);
    }
    return (0, core_js_1.safeReply)(i, { content: 'Cleanup complete.', ephemeral: true });
} }
async function tagCommand(i) {
    const sub = i.options.getSubcommand();
    const name = i.options.getString('name').toLowerCase();
    if (sub === 'get') {
        const t = db_js_1.db.prepare('SELECT * FROM tags WHERE guild_id=? AND name=?').get(i.guildId, name);
        return (0, core_js_1.safeReply)(i, { content: t?.content ?? 'Tag not found.', ephemeral: !t });
    }
    if (sub === 'add') {
        db_js_1.db.prepare('INSERT OR REPLACE INTO tags(guild_id,name,content,author_id,updated_at) VALUES(?,?,?,?,?)').run(i.guildId, name, i.options.getString('content'), i.user.id, Date.now());
        return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
    }
    if (sub === 'edit') {
        const t = db_js_1.db.prepare('SELECT * FROM tags WHERE guild_id=? AND name=?').get(i.guildId, name);
        if (!t)
            throw new Error('Tag not found.');
        if (t.author_id !== i.user.id && !(0, core_js_1.isStaff)(i.member))
            throw new Error(config_js_1.config.messages.staffOnly);
        db_js_1.db.prepare('UPDATE tags SET content=?,updated_at=? WHERE guild_id=? AND name=?').run(i.options.getString('content'), Date.now(), i.guildId, name);
        return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
    }
    if (sub === 'remove') {
        db_js_1.db.prepare('DELETE FROM tags WHERE guild_id=? AND name=?').run(i.guildId, name);
        return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
    }
    const rows = db_js_1.db.prepare('SELECT name FROM tags WHERE guild_id=? ORDER BY name LIMIT 100').all(i.guildId);
    const desc = rows.map(r => '`' + r.name + '`').join('\n') || 'No tags.';
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Tags', description: desc })], ephemeral: true });
}
async function customCmdCommand(i) {
    const sub = i.options.getSubcommand();
    const name = i.options.getString('name').toLowerCase();
    if (sub === 'add') {
        db_js_1.db.prepare('INSERT OR REPLACE INTO custom_commands(guild_id,name,reply,created_by,updated_at) VALUES(?,?,?,?,?)').run(i.guildId, name, i.options.getString('reply'), i.user.id, Date.now());
        return (0, core_js_1.safeReply)(i, { content: 'Added `' + (0, db_js_1.getGuildConfig)(i.guildId).discord.defaultPrefix + name + '`.', ephemeral: true });
    }
    if (sub === 'remove') {
        db_js_1.db.prepare('DELETE FROM custom_commands WHERE guild_id=? AND name=?').run(i.guildId, name);
        return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
    }
    const rows = db_js_1.db.prepare('SELECT name FROM custom_commands WHERE guild_id=? ORDER BY name LIMIT 250').all(i.guildId);
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Custom Commands', description: rows.map(r => '`' + r.name + '`').join('\n') || 'None.' })], ephemeral: true });
}
async function stickyCommand(i) { const sub = i.options.getSubcommand(); if (sub === 'set') {
    (0, community_js_1.setSticky)(i.guildId, i.channelId, i.options.getString('text'));
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'remove') {
    (0, community_js_1.removeSticky)(i.guildId, i.channelId);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Sticky Messages', description: (0, community_js_1.listSticky)(i.guildId).map(x => `<#${x.channel_id}>`).join('\n') || 'None.' })], ephemeral: true }); }
async function counterCommand(i) { const sub = i.options.getSubcommand(); if (sub === 'add') {
    (0, community_js_1.addCounter)(i.guildId, i.options.getChannel('channel').id, i.options.getString('metric'));
    await (0, community_js_1.refreshCounters)(i.guild);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'remove') {
    (0, community_js_1.removeCounter)(i.options.getChannel('channel').id);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Counters', description: (0, community_js_1.listCounters)(i.guildId).map(x => `<#${x.channel_id}> → ${x.metric}`).join('\n') || 'None.' })], ephemeral: true }); }
async function imgOnlyCommand(i, cfg) {
    const sub = i.options.getSubcommand();
    if (sub === 'add') {
        const ch = i.options.getChannel('channel');
        (0, community_js_1.toggleImageOnly)(i.guildId, ch.id, true);
        return (0, core_js_1.safeReply)(i, { content: `Image-only enabled for <#${ch.id}>.`, ephemeral: true });
    }
    if (sub === 'remove') {
        const ch = i.options.getChannel('channel');
        (0, community_js_1.toggleImageOnly)(i.guildId, ch.id, false);
        return (0, core_js_1.safeReply)(i, { content: `Image-only disabled for <#${ch.id}>.`, ephemeral: true });
    }
    if (sub === 'configure') {
        const p = cfg.imageOnlyDefaults;
        const warnings = i.options.getBoolean('warnings');
        if (warnings !== null)
            p.warningEnabled = warnings;
        const warningThreshold = i.options.getInteger('warning_threshold');
        if (warningThreshold !== null)
            p.warningThreshold = warningThreshold;
        const windowSeconds = i.options.getInteger('window_seconds');
        if (windowSeconds !== null)
            p.warningWindowSeconds = windowSeconds;
        const notify = i.options.getString('notify');
        if (notify !== null)
            p.notifyMode = notify;
        const timeoutEnabled = i.options.getBoolean('timeout_enabled');
        if (timeoutEnabled !== null)
            p.timeoutEnabled = timeoutEnabled;
        const timeoutThreshold = i.options.getInteger('timeout_threshold');
        if (timeoutThreshold !== null)
            p.timeoutThreshold = timeoutThreshold;
        const timeoutSeconds = i.options.getInteger('timeout_seconds');
        if (timeoutSeconds !== null)
            p.timeoutSeconds = timeoutSeconds;
        (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
        return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Image-only Settings Saved', description: `Warnings: **${p.warningEnabled ? 'Enabled' : 'Disabled'}**\nWarning threshold: **${p.warningThreshold}**\nCounting window: **${p.warningWindowSeconds}s**\nNotification: **${p.notifyMode}**\nTimeouts: **${p.timeoutEnabled ? 'Enabled' : 'Disabled'}**\nTimeout threshold: **${p.timeoutThreshold}**\nTimeout length: **${p.timeoutSeconds}s**`, color: config_js_1.config.brand.success })], ephemeral: true });
    }
    const p = cfg.imageOnlyDefaults;
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Image-only Channels', description: `**Channels**\n${(0, community_js_1.imageOnlyList)(i.guildId).map(x => `<#${x.channel_id}>`).join('\n') || 'None.'}\n\n**Violation Policy**\nWarnings: **${p.warningEnabled ? 'Enabled' : 'Disabled'}** at **${p.warningThreshold}** hits in **${p.warningWindowSeconds}s**\nTimeouts: **${p.timeoutEnabled ? 'Enabled' : 'Disabled'}** at **${p.timeoutThreshold}** hits for **${p.timeoutSeconds}s**\nNotice delivery: **${p.notifyMode}**\n\nUse \`/imgonly configure\` to update thresholds.`, color: config_js_1.config.brand.info })], ephemeral: true });
}
async function honeypotCommand(i, cfg) {
    const sub = i.options.getSubcommand();
    const p = cfg.honeypotDefaults;
    if (sub === 'add' || sub === 'remove') {
        const ch = i.options.getChannel('channel');
        p.channelIds = Array.isArray(p.channelIds) ? p.channelIds : [];
        if (sub === 'add' && !p.channelIds.includes(ch.id))
            p.channelIds.push(ch.id);
        if (sub === 'remove')
            p.channelIds = p.channelIds.filter(id => id !== ch.id);
        if (sub === 'add' && p.channelIds.length)
            p.enabled = true;
        (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
        if (sub === 'add')
            await ch.send({ embeds: [(0, core_js_1.makeEmbed)({ title: p.warningTitle || 'DO NOT SEND MESSAGES IN THIS CHANNEL', description: p.warningDescription || 'This channel is used to detect spam bots and malicious activity. Do not send messages here. Sending messages may result in a warning, timeout, kick, or ban.', color: config_js_1.config.brand.warning })] }).catch(error => console.warn(`[Auralis] honeypot warning panel could not be posted in ${ch.id}: ${error?.message ?? error}`));
        return (0, core_js_1.safeReply)(i, { content: sub === 'add' ? `Honeypot enabled for <#${ch.id}>. Current action: ${p.action}. The warning panel was posted when channel permissions allowed it.` : `Honeypot removed from <#${ch.id}>.`, ephemeral: true });
    }
    if (sub === 'configure') {
        const enabled = i.options.getBoolean('enabled');
        if (enabled !== null)
            p.enabled = enabled;
        const threshold = i.options.getInteger('threshold');
        if (threshold !== null)
            p.threshold = threshold;
        const windowSeconds = i.options.getInteger('window_seconds');
        if (windowSeconds !== null)
            p.windowSeconds = windowSeconds;
        const action = i.options.getString('action');
        if (action !== null)
            p.action = action;
        const timeoutSeconds = i.options.getInteger('timeout_seconds');
        if (timeoutSeconds !== null)
            p.timeoutSeconds = timeoutSeconds;
        const logChannel = i.options.getChannel('log_channel');
        if (logChannel)
            p.logChannelId = logChannel.id;
        const notify = i.options.getBoolean('notify_user');
        if (notify !== null)
            p.notifyUser = notify;
        (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
        return (0, core_js_1.safeReply)(i, { content: `Honeypot settings saved.\nEnabled: **${p.enabled ? 'Yes' : 'No'}**\nChannels: **${p.channelIds.length}**\nThreshold: **${p.threshold}** in **${p.windowSeconds}s**\nAction: **${p.action}**`, ephemeral: true });
    }
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Honeypot Settings', description: `Enabled: **${p.enabled ? 'Yes' : 'No'}**\nConfigured Channels: ${p.channelIds.length ? p.channelIds.map(id => `<#${id}>`).join(', ') : 'None'}\nThreshold: **${p.threshold}** in **${p.windowSeconds}s**\nAction: **${p.action}**\nTimeout duration: **${p.timeoutSeconds}s**\nLog channel: ${p.logChannelId ? `<#${p.logChannelId}>` : 'AutoMod/Audit log'}\nUser DM: **${p.notifyUser ? 'Enabled' : 'Disabled'}**\n\nUse \`/honeypot add\`, \`/honeypot remove\`, and \`/honeypot configure\`.`, color: config_js_1.config.brand.info })], ephemeral: true });
}
async function verifyCommand(i, cfg) { cfg.verifyDefaults.enabled = true; cfg.verifyDefaults.channelId = i.options.getChannel('channel').id; cfg.verifyDefaults.roleId = i.options.getRole('role').id; (0, db_js_1.saveGuildConfig)(i.guildId, cfg); const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('verify').setLabel(cfg.verifyDefaults.buttonLabel).setStyle(discord_js_1.ButtonStyle.Success)); await i.options.getChannel('channel').send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Verify', description: cfg.verifyDefaults.message, color: config_js_1.config.brand.success })], components: [row] }); return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true }); }
async function suggestCommand(i, cfg) { const sub = i.options.getSubcommand(); if (sub === 'new') {
    const id = (0, community_js_1.addSuggestion)(i.guildId, i.user.id, i.options.getString('text'));
    const ch = cfg.suggestionDefaults.channelId ? i.guild.channels.cache.get(cfg.suggestionDefaults.channelId) : i.channel;
    const m = await ch.send({ embeds: [(0, core_js_1.makeEmbed)({ title: `Suggestion #${id}`, description: i.options.getString('text'), color: config_js_1.config.brand.info })] });
    db_js_1.db.prepare('UPDATE suggestions SET message_id=? WHERE id=?').run(m.id, id);
    return (0, core_js_1.safeReply)(i, { content: `Suggestion #${id} submitted.`, ephemeral: true });
} const id = i.options.getInteger('id'); if (['approve', 'deny'].includes(sub)) {
    (0, community_js_1.updateSuggestion)(id, i.guildId, sub === 'approve' ? 'approved' : 'denied');
    const s = (0, community_js_1.suggestion)(id, i.guildId);
    if (s?.message_id && cfg.suggestionDefaults.channelId) {
        const ch = i.guild.channels.cache.get(cfg.suggestionDefaults.channelId);
        const m = await ch?.messages.fetch(s.message_id).catch(() => null);
        await m?.edit({ embeds: [(0, core_js_1.makeEmbed)({ title: `Suggestion #${id} — ${sub}`, description: s.text, color: sub === 'approve' ? config_js_1.config.brand.success : config_js_1.config.brand.danger })] });
    }
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} cfg.suggestionDefaults.channelId = i.options.getChannel('channel').id; (0, db_js_1.saveGuildConfig)(i.guildId, cfg); return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true }); }
async function pollCommand(i) { const options = ['opt1', 'opt2', 'opt3', 'opt4', 'opt5'].map(k => i.options.getString(k)).filter(Boolean); const channel = i.options.getChannel('channel') ?? i.channel; if (!channel?.isTextBased?.() || typeof channel.send !== 'function')
    throw new Error('Choose a text channel where Auralis can send messages.'); await (0, core_js_1.deferEphemeral)(i); const msg = await (0, polls_js_1.startPoll)(channel, i.user, i.options.getString('question'), options, { title: i.options.getString('title'), description: i.options.getString('description'), duration: i.options.getString('duration') }); return (0, core_js_1.safeReply)(i, { content: `Poll created in <#${channel.id}>: ${msg.url}`, ephemeral: true }); }
async function giveawayCommand(i) {
    const sub = i.options.getSubcommand();
    if (sub === 'start') {
        await (0, core_js_1.deferEphemeral)(i);
        const cfg = (0, db_js_1.getGuildConfig)(i.guildId);
        const durationText = i.options.getString('duration') || cfg.giveawayDefaults.defaultDuration || '24h';
        const ms = (0, core_js_1.parseDuration)(durationText);
        if (!ms || ms > 365 * 86400000)
            throw new Error('Giveaway duration must be valid and no longer than 365 days.');
        const channel = i.options.getChannel('channel') || i.channel;
        if (!channel?.isTextBased?.() || !channel.guild || channel.guild.id !== i.guildId)
            throw new Error('Choose a text channel in this server.');
        const winners = i.options.getInteger('winners') || Number(cfg.giveawayDefaults.defaultWinners) || 1;
        const msg = await (0, giveaways_js_1.startGiveaway)(channel, i.user, ms, winners, i.options.getString('prize'), { title: i.options.getString('title'), description: i.options.getString('description') });
        return (0, core_js_1.safeReply)(i, { content: `Giveaway started: ${msg}`, ephemeral: true });
    }
    if (sub === 'list')
        return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Active Giveaways', description: (0, giveaways_js_1.activeGiveaways)(i.guildId).map(g => `${g.message_id} — ${g.prize} — <t:${Math.floor(g.end_at / 1000)}:R>`).join('\n') || 'No active giveaways.' })], ephemeral: true });
    const id = i.options.getString('msg');
    const g = (0, giveaways_js_1.giveaway)(id);
    if (!g || String(g.guild_id) !== String(i.guildId))
        throw new Error('Giveaway not found in this server.');
    if (sub === 'end' || sub === 'cancel') {
        if (g.status !== 'active')
            throw new Error('This giveaway is not active.');
        await (0, giveaways_js_1.finishGiveaway)(i.client, g, sub === 'cancel' ? 'cancel' : 'end');
        return (0, core_js_1.safeReply)(i, { content: sub === 'cancel' ? 'Giveaway cancelled.' : 'Giveaway ended.', ephemeral: true });
    }
    if (sub === 'reroll') {
        const winners = await (0, giveaways_js_1.rerollGiveaway)(i.client, g, i.options.getInteger('winners'));
        return (0, core_js_1.safeReply)(i, { content: `Giveaway rerolled. Selected ${winners.length} winner(s).`, ephemeral: true });
    }
    if (sub === 'edit') {
        let field = i.options.getString('field');
        const value = i.options.getString('value');
        let val = value;
        if (field === 'duration') {
            const ms = (0, core_js_1.parseDuration)(value);
            if (!ms || ms > 365 * 86400000)
                throw new Error(config_js_1.config.messages.invalidDuration);
            val = Date.now() + ms;
            field = 'end_at';
        }
        if (field === 'winners') {
            val = Number(value);
            if (!Number.isInteger(val) || val < 1 || val > 25)
                throw new Error('Winner count must be between 1 and 25.');
        }
        if (field === 'color')
            val = (0, core_js_1.safeHexColor)(value, g.color);
        if (field === 'prize')
            val = value.slice(0, 250);
        if (field === 'description')
            val = value.slice(0, 1000);
        if (field === 'title')
            val = value.slice(0, 256);
        if (!(0, giveaways_js_1.editGiveawayField)(id, field, val))
            throw new Error('That field cannot be edited.');
        const next = (0, giveaways_js_1.giveaway)(id);
        await (0, giveaways_js_1.updateGiveawayMessage)(i.client, next).catch(error => console.warn(`[Auralis] giveaway edit display update failed: ${error?.message ?? error}`));
        return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
    }
}
async function timezoneCommand(i) { if (i.options.getSubcommand() === 'set') {
    const tz = i.options.getString('iana');
    try {
        new Intl.DateTimeFormat('en', { timeZone: tz }).format();
    }
    catch {
        throw new Error('Invalid IANA timezone.');
    }
    (0, community_js_1.setTimezone)(i.user.id, tz);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} const user = i.options.getUser('user') ?? i.user; return (0, core_js_1.safeReply)(i, { content: `<@${user.id}> — ${(0, community_js_1.getTimezone)(user.id)}`, ephemeral: true }); }
async function timeCommand(i) { const user = i.options.getUser('user') ?? i.user; const tz = (0, community_js_1.getTimezone)(user.id); const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(new Date()); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Local Time', description: `${user}\n**${time}**\n${tz}`, color: config_js_1.config.brand.info })] }); }
async function birthdayCommand(i, cfg) { const sub = i.options.getSubcommand(); if (sub === 'set') {
    const m = i.options.getString('date').match(/^(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])$/);
    if (!m)
        throw new Error('Use MM-DD.');
    (0, community_js_1.setBirthday)(i.guildId, i.user.id, Number(m[1]), Number(m[2]));
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} if (sub === 'view') {
    const user = i.options.getUser('user') ?? i.user;
    const b = (0, community_js_1.getBirthday)(i.guildId, user.id);
    return (0, core_js_1.safeReply)(i, { content: b ? `${user}: ${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}` : 'No birthday set.', ephemeral: true });
} if (sub === 'list') {
    const rows = (0, community_js_1.birthdays)(i.guildId);
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Birthdays', description: rows.map(b => `<@${b.user_id}> — ${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`).join('\n') || 'None.' })], ephemeral: true });
} if (sub === 'setchannel') {
    cfg.birthdayDefaults.channelId = i.options.getChannel('channel').id;
    (0, db_js_1.saveGuildConfig)(i.guildId, cfg);
    return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true });
} cfg.birthdayDefaults.roleId = i.options.getRole('role').id; (0, db_js_1.saveGuildConfig)(i.guildId, cfg); return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true }); }
async function templateCommand(i, cfg) { const action = i.options.getString('action'), sub = i.options.getSubcommand(); if (!(action in cfg.dmTemplates))
    throw new Error('Unknown template.'); if (sub === 'view')
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: `Template — ${action}`, description: cfg.dmTemplates[action] })], ephemeral: true }); if (sub === 'set')
    cfg.dmTemplates[action] = i.options.getString('message');
else if (sub === 'reset') {
    const defaults = config_js_1.config.dmTemplates;
    cfg.dmTemplates[action] = defaults[action];
} (0, db_js_1.saveGuildConfig)(i.guildId, cfg); return (0, core_js_1.safeReply)(i, { content: config_js_1.config.messages.saved, ephemeral: true }); }
async function webhookCommand(i) { const sub = i.options.getSubcommand(); if (sub === 'create') {
    const w = await i.channel.createWebhook({ name: i.options.getString('name') });
    return (0, core_js_1.safeReply)(i, { content: `Webhook created: \`${w.id}\``, ephemeral: true });
} const webhooks = await i.channel.fetchWebhooks(); if (sub === 'list')
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Webhooks', description: [...webhooks.values()].map(w => `**${w.name}** — ${w.id}`).join('\n') || 'None.' })], ephemeral: true }); const w = webhooks.get(i.options.getString('id')); if (!w)
    throw new Error('Webhook not found.'); if (sub === 'delete') {
    await w.delete();
    return (0, core_js_1.safeReply)(i, { content: 'Deleted.', ephemeral: true });
} await w.send({ content: i.options.getString('message') }); return (0, core_js_1.safeReply)(i, { content: 'Sent.', ephemeral: true }); }
async function embedCommand(i) { return i.showModal((0, ui_js_1.modal)('custom-embed', 'Custom Embed', [{ id: 'title', label: 'Title', style: discord_js_1.TextInputStyle.Short, required: false }, { id: 'description', label: 'Description', style: discord_js_1.TextInputStyle.Paragraph, required: true }, { id: 'color', label: 'Hex color', style: discord_js_1.TextInputStyle.Short, required: false, value: '#8B7CFF' }])); }
async function announceCommand(i) { const cfg = (0, db_js_1.getGuildConfig)(i.guildId); if (cfg.modules?.announcements === false)
    throw new Error('Announcements are disabled for this server. Enable them in Dashboard → Modules.'); const ch = i.options.getChannel('channel') ?? i.channel; const message = i.options.getString('message'); await ch.send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Announcement', description: message, color: config_js_1.config.brand.info })] }); return (0, core_js_1.safeReply)(i, { content: `Announcement sent to <#${ch.id}>.`, ephemeral: true }); }
async function serverInfo(i) { const g = i.guild; return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: g.name, description: `Owner: <@${g.ownerId}>\nMembers: **${g.memberCount}**\nChannels: **${g.channels.cache.size}**\nRoles: **${g.roles.cache.size}**\nBoosts: **${g.premiumSubscriptionCount ?? 0}**`, color: config_js_1.config.brand.primary, thumbnail: g.iconURL({ size: 256 }) })] }); }
async function userInfo(i) { const u = i.options.getUser('user') ?? i.user; const m = await i.guild.members.fetch(u.id).catch(() => null); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: u.tag, description: `ID: \`${u.id}\`\nCreated: <t:${Math.floor(u.createdTimestamp / 1000)}:F>\nJoined: ${m ? `<t:${Math.floor(m.joinedTimestamp / 1000)}:F>` : 'Unknown'}\nRoles: ${m ? [...m.roles.cache.filter(r => r.id !== i.guild.id).values()].slice(0, 15).map(r => r.toString()).join(' ') || 'None' : 'Unknown'}`, color: config_js_1.config.brand.info, thumbnail: u.displayAvatarURL({ size: 256 }) })] }); }
async function channelInfo(i) { const c = i.options.getChannel('channel') ?? i.channel; return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: c.name, description: `ID: \`${c.id}\`\nType: **${c.type}**\nCreated: <t:${Math.floor(c.createdTimestamp / 1000)}:F>\nPosition: **${c.rawPosition ?? 0}**`, color: config_js_1.config.brand.neutral })] }); }
async function roleInfo(i) { const r = i.options.getRole('role'); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: r.name, description: `ID: \`${r.id}\`\nMembers: **${r.members.size}**\nPosition: **${r.position}**\nMentionable: **${r.mentionable ? 'Yes' : 'No'}**`, color: r.color || config_js_1.config.brand.neutral })] }); }
async function avatarCommand(i, banner) { const u = i.options.getUser('user') ?? i.user; const full = await u.fetch(); const url = banner ? full.bannerURL({ size: 2048 }) ?? null : full.displayAvatarURL({ size: 2048, extension: 'png' }); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: banner ? 'Banner' : 'Avatar', description: url ? `[Open image](${url})` : 'No banner set.', color: config_js_1.config.brand.primary, image: url })] }); }
async function memberCount(i) { const humans = i.guild.members.cache.filter(m => !m.user.bot).size, bots = i.guild.members.cache.filter(m => m.user.bot).size; return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Member Count', description: `Members: **${i.guild.memberCount}**\nHumans: **${humans}**\nBots: **${bots}**`, color: config_js_1.config.brand.info })] }); }
async function assetList(i, type) { const items = type === 'roles' ? [...i.guild.roles.cache.values()].filter(r => r.id !== i.guild.id).map(r => r.toString()) : type === 'emojis' ? [...i.guild.emojis.cache.values()].map(e => e.toString()) : [...i.guild.stickers.cache.values()].map(s => s.name); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: type[0].toUpperCase() + type.slice(1), description: (0, core_js_1.truncate)(items.join(' — ') || 'None.', 4000), color: config_js_1.config.brand.neutral })] }); }
async function inRole(i) { const role = i.options.getRole('role'); const members = [...role.members.values()]; const s = (0, core_js_1.pageSlice)(members, i.options.getInteger('page') ?? 1, 20); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: `${role.name} — ${s.page}/${s.totalPages}`, description: s.items.map(m => `${m}`).join('\n') || 'No members.', color: role.color || config_js_1.config.brand.neutral })] }); }
async function newUsers(i) { const amount = i.options.getInteger('amount') ?? 10; const members = [...i.guild.members.cache.values()].sort((a, b) => (b.joinedTimestamp ?? 0) - (a.joinedTimestamp ?? 0)).slice(0, amount); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Newest Members', description: members.map((m, n) => `${n + 1}. ${m} — <t:${Math.floor((m.joinedTimestamp ?? Date.now()) / 1000)}:R>`).join('\n') })] }); }
async function boomer(i) { const members = [...i.guild.members.cache.values()].sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0)); const m = members[0]; return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Oldest Member', description: m ? `${m} — <t:${Math.floor((m.joinedTimestamp ?? Date.now()) / 1000)}:F>` : 'No member data.' })] }); }
async function inviteInfo(i) { const code = i.options.getString('code').replace(/^.*invite\//, ''); const invite = await i.client.fetchInvite(code, { withCounts: true }).catch(() => null); if (!invite)
    throw new Error('Invite not found.'); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Invite Info', description: `Guild: **${invite.guild?.name ?? 'Unknown'}**\nMembers: **${invite.memberCount ?? 0}**\nOnline: **${invite.presenceCount ?? 0}**\nChannel: **${invite.channel?.name ?? 'Unknown'}**`, color: config_js_1.config.brand.info })] }); }
async function invites(i) { const rows = await i.guild.invites.fetch(); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Active Invites', description: [...rows.values()].map(x => `\`${x.code}\` — ${x.inviter ?? 'Unknown'} — uses ${x.uses ?? 0}`).join('\n') || 'None.' })], ephemeral: true }); }
async function translate(i) { await (0, core_js_1.deferEphemeral)(i); const lang = i.options.getString('lang'), text = i.options.getString('text'); const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(text)}`; const data = await (0, core_js_1.fetchJson)(url, { timeoutMs: 12000 }); const out = data?.[0]?.map(x => x?.[0]).join('') ?? ''; if (!out)
    throw new Error('The translation service returned no translated text. Please try another language or try again later.'); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: `Translation — ${lang}`, description: (0, core_js_1.truncate)(out, 4000), color: config_js_1.config.brand.info })] }); }
async function crypto(i) { await (0, core_js_1.deferEphemeral)(i); const data = await (0, core_js_1.fetchJson)('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,monero,ripple,solana,dogecoin,cardano&vs_currencies=usd', { timeoutMs: 12000 }); const entries = Object.entries(data ?? {}).filter(([, v]) => Number.isFinite(Number(v?.usd))); if (!entries.length)
    throw new Error('The crypto price service did not return any prices. Please try again later.'); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: 'Crypto Prices', description: entries.map(([k, v]) => `**${k}** $${Number(v.usd).toLocaleString('en-US', { maximumFractionDigits: 8 })}`).join('\n'), color: config_js_1.config.brand.success })] }); }
async function colorCommand(i) { const hex = i.options.getString('hex'); const value = (0, community_js_1.parseColorHex)(hex); return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: hex.toUpperCase(), description: `Decimal: **${value}**\nRGB: **${value >> 16}, ${(value >> 8) & 255}, ${value & 255}**`, color: value })] }); }
async function randomHex(i) {
    const value = Math.floor(Math.random() * 0xffffff);
    const hex = `#${value.toString(16).padStart(6, '0').toUpperCase()}`;
    return (0, core_js_1.safeReply)(i, { embeds: [(0, core_js_1.makeEmbed)({ title: hex, description: `
\`${hex}\``, color: value })] });
}
async function remindCommand(i) { const ms = (0, core_js_1.parseDuration)(i.options.getString('duration')); if (!ms)
    throw new Error(config_js_1.config.messages.invalidDuration); db_js_1.db.prepare('INSERT INTO reminders(user_id,guild_id,channel_id,fire_at,message) VALUES(?,?,?,?,?)').run(i.user.id, i.guildId, i.channelId, Date.now() + ms, i.options.getString('message')); return (0, core_js_1.safeReply)(i, { content: `Reminder set for ${(0, core_js_1.formatDuration)(ms)}.`, ephemeral: true }); }
async function afkCommand(i) { const map = globalThis.__auralisAfk ?? (globalThis.__auralisAfk = new Map()); const reason = i.options.getString('reason'); if (reason)
    map.set(`${i.guildId}:${i.user.id}`, reason);
else
    map.delete(`${i.guildId}:${i.user.id}`); return (0, core_js_1.safeReply)(i, { content: reason ? `AFK set: ${reason}` : 'AFK removed.', ephemeral: true }); }
async function handleComponent(interaction, client) {
    try {
        if (interaction.isAnySelectMenu?.() && interaction.customId === 'help:category') {
            const requested = interaction.values?.[0];
            const group = helpGroups().includes(requested) ? requested : helpGroups()[0];
            return interaction.update({ embeds: [helpEmbed(group, 1)], components: helpComponents(group, 1) });
        }
        if (interaction.isButton()) {
            const id = interaction.customId;
            if (id.startsWith('ticket:create:'))
                return (0, tickets_js_1.openTicketCreation)(interaction, id.split(':')[2]);
            if (id.startsWith('application:create:'))
                return (0, applications_js_1.showApplicationModal)(interaction, id.split(':')[2], ui_js_1.modal);
            if (id === 'ticket:close')
                return ticketCloseCommand(interaction);
            if (id === 'ticket:claim') {
                const result = await (0, tickets_js_1.claimTicket)(interaction.channel, interaction.member);
                return (0, core_js_1.safeReply)(interaction, { content: result.message, ephemeral: true });
            }
            if (id === 'ticket:close-reason') {
                const closeModal = new discord_js_1.ModalBuilder().setCustomId('ticket:close-reason-modal').setTitle('Close ticket with reason').addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder().setCustomId('reason').setLabel('Why is this ticket being closed?').setStyle(discord_js_1.TextInputStyle.Paragraph).setRequired(true).setMaxLength(800)));
                return interaction.showModal(closeModal);
            }
            if (id === 'ticket:add' || id === 'ticket:remove')
                return (0, core_js_1.safeReply)(interaction, { content: 'Use `/add` or `/remove` with a member.', ephemeral: true });
            if (id === 'verify') {
                const cfg = (0, db_js_1.getGuildConfig)(interaction.guildId);
                const role = interaction.guild.roles.cache.get(String(cfg.verifyDefaults?.roleId || ''));
                if (!role)
                    return (0, core_js_1.safeReply)(interaction, { content: 'Verification is not configured. A server administrator must choose a verified role in Dashboard → Security.', ephemeral: true });
                if (interaction.member.roles.cache.has(role.id))
                    return (0, core_js_1.safeReply)(interaction, { content: config_js_1.config.messages.verificationAlready, ephemeral: true });
                try {
                    await interaction.member.roles.add(role, 'Auralis verification button');
                }
                catch (error) {
                    return (0, core_js_1.safeReply)(interaction, { content: `Verification could not be completed: ${(0, core_js_1.cleanError)(error)}. Check that Auralis has Manage Roles and that its highest role is above ${role}.`, ephemeral: true });
                }
                const dmSent = await (0, core_js_1.dmTemplate)(interaction.user, interaction.guild, cfg.dmTemplates.verify, { user: interaction.user.tag, username: interaction.user.username, moderator: 'Auralis', role: role.name }).catch(() => false);
                return (0, core_js_1.safeReply)(interaction, { content: `${config_js_1.config.messages.verificationSuccess} You received ${role}.${dmSent ? ' A confirmation DM was sent.' : ''}`, ephemeral: true });
            }
            if (id.startsWith('rolebtn:')) {
                const [, msgId, index] = id.split(':');
                const r = (0, reactions_js_1.buttonRoles)(interaction.guildId, msgId).find(x => String(x.component_index) === index);
                if (!r)
                    return (0, core_js_1.safeReply)(interaction, { content: 'Role button no longer exists.', ephemeral: true });
                const role = interaction.guild.roles.cache.get(r.role_id);
                if (!role)
                    return (0, core_js_1.safeReply)(interaction, { content: 'Role no longer exists.', ephemeral: true });
                const has = interaction.member.roles.cache.has(role.id);
                has ? await interaction.member.roles.remove(role) : await interaction.member.roles.add(role);
                return (0, core_js_1.safeReply)(interaction, { content: has ? 'Role removed.' : 'Role added.', ephemeral: true });
            }
            if (id.startsWith('tpanel:')) {
                const parts = id.split(':');
                const panelId = parts[1];
                const componentId = parts.slice(2).join(':');
                const panel = (0, tickets_js_1.getTicketPanel)(interaction.guildId, panelId);
                const component = panel?.components?.find(c => String(c.id) === componentId);
                if (!component)
                    return (0, core_js_1.safeReply)(interaction, { content: 'This panel component is no longer available.', ephemeral: true });
                if (component.type === 'button' && component.action === 'create_ticket')
                    return (0, tickets_js_1.openTicketCreation)(interaction, String(component.ticketType || 'support'));
                if (component.type !== 'link' && component.action === 'message')
                    return (0, core_js_1.safeReply)(interaction, { content: String(component.response || 'Action completed.').slice(0, 1900), ephemeral: true });
                return (0, core_js_1.safeReply)(interaction, { content: 'Selection received.', ephemeral: true });
            }
            if (id.startsWith('poll:'))
                return (0, polls_js_1.handlePollInteraction)(interaction, client);
            if (id === 'setup:close')
                return interaction.update({ components: [] });
            if (id.startsWith('help:prev:') || id.startsWith('help:next:')) {
                const [, direction, group, pageRaw] = id.split(':');
                const current = Number(pageRaw) || 1;
                const target = direction === 'prev' ? current - 1 : current + 1;
                const names = helpEntriesForGroup(group);
                const total = Math.max(1, Math.ceil(names.length / HELP_COMMANDS_PER_PAGE));
                const page = Math.min(Math.max(1, target), total);
                return interaction.update({ embeds: [helpEmbed(group, page)], components: helpComponents(group, page) });
            }
            if (id.startsWith('setup:'))
                return setupSection(interaction, id.split(':')[1]);
            if (id === 'staffactivity:check')
                return (0, staff_activity_js_1.showStaffActivity)(interaction);
            if (id.startsWith('staffactivity:respond:'))
                return (0, staff_activity_js_1.respondToStaffActivity)(interaction, Number(id.split(':')[2]));
            if (id === 'giveaway:enter') {
                const g = (0, giveaways_js_1.giveaway)(interaction.message.id);
                if (!g || g.status !== 'active' || Number(g.end_at) <= Date.now())
                    return (0, core_js_1.safeReply)(interaction, { content: 'This giveaway is no longer active.', ephemeral: true });
                const cfg = (0, db_js_1.getGuildConfig)(interaction.guildId).giveawayDefaults ?? {};
                let constraints = {};
                try {
                    constraints = JSON.parse(g.constraints || '{}');
                }
                catch { }
                const member = interaction.member;
                const minAccountAgeDays = Math.max(0, Number(constraints.minAccountAgeDays ?? cfg.minAccountAgeDays ?? 0));
                const minServerAgeDays = Math.max(0, Number(constraints.minServerAgeDays ?? cfg.minServerAgeDays ?? cfg.minimumServerAgeDays ?? 0));
                if (minAccountAgeDays && Date.now() - Number(interaction.user.createdTimestamp || Date.now()) < minAccountAgeDays * 86400000)
                    return (0, core_js_1.safeReply)(interaction, { content: `Your Discord account must be at least ${minAccountAgeDays} day(s) old to enter this giveaway.`, ephemeral: true });
                if (minServerAgeDays && Date.now() - Number(member?.joinedTimestamp || Date.now()) < minServerAgeDays * 86400000)
                    return (0, core_js_1.safeReply)(interaction, { content: `You must have been a member of this server for at least ${minServerAgeDays} day(s) to enter this giveaway.`, ephemeral: true });
                const requiredRoleIds = Array.isArray(constraints.requiredRoleIds) ? constraints.requiredRoleIds : [];
                if (requiredRoleIds.length && !requiredRoleIds.some(roleId => member?.roles?.cache?.has(String(roleId))))
                    return (0, core_js_1.safeReply)(interaction, { content: 'You do not have a required role for this giveaway.', ephemeral: true });
                const inserted = (0, giveaways_js_1.enterGiveaway)(interaction.message.id, interaction.user.id);
                if (!inserted)
                    return (0, core_js_1.safeReply)(interaction, { content: 'You are already entered in this giveaway.', ephemeral: true });
                await (0, giveaways_js_1.updateGiveawayMessage)(client, g).catch(error => console.warn(`[Auralis] giveaway entry count update failed: ${error?.message ?? error}`));
                return (0, core_js_1.safeReply)(interaction, { content: 'Your entry has been recorded.', ephemeral: true });
            }
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket:create-submit:'))
            return (0, tickets_js_1.submitTicketCreation)(interaction, interaction.customId.split(':')[2]);
        if (interaction.isModalSubmit() && interaction.customId === 'ticket:close-reason-modal') {
            const reason = interaction.fields.getTextInputValue('reason').trim();
            await (0, core_js_1.deferEphemeral)(interaction);
            const result = await (0, tickets_js_1.closeTicket)(interaction.channel, interaction.member, client, reason);
            if (!result.ok)
                return (0, core_js_1.safeReply)(interaction, { content: result.message, ephemeral: true });
            const delivery = result.dmSent ? 'A confirmation DM was sent to the ticket owner.' : result.dmEnabled ? 'The ticket owner could not be DM’d.' : 'Ticket-close DMs are disabled.';
            return (0, core_js_1.safeReply)(interaction, { content: `Ticket closed. The closing reason was recorded. ${delivery}`, ephemeral: true });
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith('application:submit:'))
            return (0, applications_js_1.submitApplication)(interaction, client, interaction.customId.split(':')[2]);
        if (interaction.isModalSubmit() && interaction.customId === 'custom-embed') {
            const title = interaction.fields.getTextInputValue('title');
            const description = interaction.fields.getTextInputValue('description');
            const color = (0, core_js_1.safeHexColor)(interaction.fields.getTextInputValue('color'), config_js_1.config.brand.primary);
            await interaction.channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title, description, color })] });
            return (0, core_js_1.safeReply)(interaction, { content: 'Embed sent.', ephemeral: true });
        }
        if (interaction.isAnySelectMenu?.() && interaction.customId.startsWith('tpanel:')) {
            const parts = interaction.customId.split(':');
            const panelId = parts[1];
            const componentId = parts.slice(2).join(':');
            const panel = (0, tickets_js_1.getTicketPanel)(interaction.guildId, panelId);
            const component = panel?.components?.find(c => String(c.id) === componentId);
            if (component?.type === 'string_select' && Array.isArray(component.options)) {
                const firstTicket = interaction.values.map(value => component.options.find(o => String(o.value) === String(value))).find(Boolean);
                if (firstTicket?.ticketType)
                    return (0, tickets_js_1.openTicketCreation)(interaction, String(firstTicket.ticketType));
            }
            const response = String(component?.response || '').replace('{values}', interaction.values.join(', ')).slice(0, 1900);
            return (0, core_js_1.safeReply)(interaction, { content: response || `Selected: ${interaction.values.join(', ')}`, ephemeral: true });
        }
        if (interaction.isStringSelectMenu())
            return (0, core_js_1.safeReply)(interaction, { content: `Selected: ${interaction.values.join(', ')}`, ephemeral: true });
    }
    catch (e) {
        const detail = (0, core_js_1.cleanError)(e);
        console.warn(`[Auralis] component action failed: ${detail}`);
        return (0, core_js_1.safeReply)(interaction, { content: `This action could not be completed: ${detail}`.slice(0, 1900), ephemeral: true }).catch(replyError => console.warn(`[Auralis] component error response failed: ${(0, core_js_1.cleanError)(replyError)}`));
    }
}
async function setupSection(i, section) {
    const cfg = (0, db_js_1.getGuildConfig)(i.guildId);
    let title = section, description = '';
    if (section === 'basic') {
        title = 'Basic';
        description = `Prefix: **${cfg.discord.defaultPrefix}**\nWelcome: **${cfg.welcomeDefaults.welcomeEnabled ? 'On' : 'Off'}**\nGoodbye: **${cfg.welcomeDefaults.goodbyeEnabled ? 'On' : 'Off'}**\nAuto roles: **${(0, community_js_1.listAutoroles)(i.guildId).length}**`;
    }
    else if (section === 'automod') {
        title = 'Auto Mod';
        description = `Enabled: **${cfg.automodDefaults.enabled ? 'On' : 'Off'}**\nAnti-link: **${cfg.automodDefaults.antiLink.enabled ? 'On' : 'Off'}**\nInvites: **${cfg.automodDefaults.invites.enabled ? 'On' : 'Off'}**\nMass mentions: **${cfg.automodDefaults.massMention.enabled ? 'On' : 'Off'}**\nMessage rate: **${cfg.automodDefaults.messageRate.enabled ? 'On' : 'Off'}**`;
    }
    else if (section === 'logs') {
        title = 'Logs';
        description = Object.entries(cfg.loggingDefaults.channels).map(([k, v]) => `**${k}**: ${v ? `<#${v}>` : 'Not set'}`).join('\n');
    }
    else if (section === 'levels') {
        title = 'Levels';
        description = `Enabled: **${cfg.levelDefaults.enabled ? 'On' : 'Off'}**\nStack rewards: **${cfg.levelDefaults.stackRoles ? 'On' : 'Off'}**\nXP range: **${cfg.levelDefaults.xpPerMessageMin}-${cfg.levelDefaults.xpPerMessageMax}**`;
    }
    else if (section === 'tickets') {
        title = 'Tickets';
        description = `Panel: **${cfg.ticketDefaults.enabled ? 'On' : 'Off'}**\nSupport roles: ${(cfg.ticketDefaults.supportRoleIds ?? []).length}\nMax open/user: **${cfg.ticketDefaults.maxOpenPerUser}**\nTranscript: **${cfg.ticketDefaults.autoTranscript ? 'On' : 'Off'}**`;
    }
    else if (section === 'applications') {
        title = 'Applications';
        description = `Enabled: **${cfg.applicationDefaults.enabled ? 'On' : 'Off'}**\nReview roles: ${(cfg.applicationDefaults.reviewRoleIds ?? []).length}\nCooldown: **${cfg.applicationDefaults.cooldownHours}h**`;
    }
    else if (section === 'security') {
        title = 'Security';
        description = `Anti-raid: **${cfg.antiRaid.enabled ? 'On' : 'Off'}**\nAnti-nuke: **${cfg.antinuke.enabled ? 'On' : 'Off'}**\nModules: ${Object.values(cfg.antinuke.modules).filter(Boolean).length}/${Object.keys(cfg.antinuke.modules).length}`;
    }
    else if (section === 'verify') {
        title = 'Verify';
        description = `Enabled: **${cfg.verifyDefaults.enabled ? 'On' : 'Off'}**\nChannel: ${cfg.verifyDefaults.channelId ? `<#${cfg.verifyDefaults.channelId}>` : 'Not set'}\nRole: ${cfg.verifyDefaults.roleId ? `<@&${cfg.verifyDefaults.roleId}>` : 'Not set'}`;
    }
    else if (section === 'welcome') {
        title = 'Welcome';
        description = `Welcome: **${cfg.welcomeDefaults.welcomeEnabled ? 'On' : 'Off'}**\nGoodbye: **${cfg.welcomeDefaults.goodbyeEnabled ? 'On' : 'Off'}**\nAuto roles: **${(0, community_js_1.listAutoroles)(i.guildId).length}**`;
    }
    else if (section === 'moderation') {
        title = 'Moderation';
        description = `Thresholds: **${cfg.moderation.thresholdEnabled ? 'On' : 'Off'}**\nWarn → Timeout: **${cfg.moderation.thresholds.warningsToTimeout}**\nWarn → Ban: **${cfg.moderation.thresholds.warningsToBan}**`;
    }
    else if (section === 'community') {
        title = 'Community';
        description = `Levels: **${cfg.levelDefaults.enabled ? 'On' : 'Off'}**\nGiveaways: **${cfg.giveawayDefaults.enabled ? 'On' : 'Off'}**\nPolls: **${cfg.pollDefaults.enabled ? 'On' : 'Off'}**`;
    }
    else if (section === 'staffactivity') {
        title = 'Staff Activity';
        description = `Enabled: **${cfg.staffActivityDefaults?.enabled !== false ? 'On' : 'Off'}**\nWindow: **${cfg.staffActivityDefaults?.windowDays ?? 30} days**\nMinimum actions: **${cfg.staffActivityDefaults?.minimumActions ?? 3}**\nMinimum ticket closes: **${cfg.staffActivityDefaults?.minimumTicketCloses ?? 1}**`;
    }
    return i.update({ embeds: [(0, core_js_1.makeEmbed)({ title: `Auralis Setup — ${title}`, description, color: config_js_1.config.brand.primary })], components: (0, ui_js_1.setupMainComponents)() });
}
function economySettings(guildId) { return (0, db_js_1.getGuildConfig)(String(guildId)).economyDefaults ?? {}; }
function economyStorageGuildId(guildId) { return String(economySettings(guildId).scope).toLowerCase() === 'global' ? '__auralis_global_economy__' : String(guildId); }
function economyCurrency(guildId) { const settings = economySettings(guildId); return `${String(settings.currencySymbol ?? '🪙').slice(0, 8)} ${String(settings.currencyName ?? 'Coins').slice(0, 24)}`.trim(); }
function economyMoney(guildId, amount) { return `${Number(amount || 0).toLocaleString('en-GB')} ${economyCurrency(guildId)}`; }
function economyResponse(guildId, key, fallback, values = {}) {
    const settings = economySettings(guildId);
    const template = String(settings.commandResponses?.[key] ?? '').trim() || fallback;
    const formatAmount = value => Number(value || 0).toLocaleString('en-GB');
    return (0, core_js_1.truncate)((0, core_js_1.replacePlaceholders)(template, {
        currency: economyCurrency(guildId), currencyName: String(settings.currencyName ?? 'Coins'), currencySymbol: String(settings.currencySymbol ?? '🪙'),
        ...values, amount: values.amount == null ? '' : formatAmount(values.amount), wallet: values.wallet == null ? '' : formatAmount(values.wallet),
        bank: values.bank == null ? '' : formatAmount(values.bank), bankCap: values.bankCap == null ? '' : formatAmount(values.bankCap), tax: values.tax == null ? '' : formatAmount(values.tax)
    }), 1900);
}
function economyRow(guildId, userId) {
    const storageGuildId = economyStorageGuildId(guildId);
    let row = db_js_1.db.prepare('SELECT * FROM economy_accounts WHERE guild_id=? AND user_id=?').get(storageGuildId, userId);
    if (!row) {
        const settings = economySettings(guildId);
        db_js_1.db.prepare('INSERT INTO economy_accounts(guild_id,user_id,wallet,bank,bank_cap) VALUES(?,?,?,?,?)').run(storageGuildId, userId, Math.max(0, Number(settings.startingWallet) || 0), Math.max(0, Number(settings.startingBank) || 0), Math.max(0, Number(settings.bankCapacity) || 1000));
        row = db_js_1.db.prepare('SELECT * FROM economy_accounts WHERE guild_id=? AND user_id=?').get(storageGuildId, userId);
    }
    return row;
}
function saveEconomy(row) { db_js_1.db.prepare('UPDATE economy_accounts SET wallet=?,bank=?,bank_cap=?,daily_streak=?,daily_at=?,work_at=?,rob_immunity_until=? WHERE guild_id=? AND user_id=?').run(row.wallet, row.bank, row.bank_cap, row.daily_streak, row.daily_at, row.work_at, row.rob_immunity_until, row.guild_id, row.user_id); }
function parseCoinAmount(input, row) { if (!input)
    return null; const raw = String(input).toLowerCase().replace(/,/g, ''); if (raw === 'all' || raw === 'max')
    return row.wallet; if (raw === 'half')
    return Math.floor(row.wallet / 2); const m = raw.match(/^(\d+(?:\.\d+)?)([km])?$/); if (!m)
    return null; const mult = m[2] === 'k' ? 1000 : m[2] === 'm' ? 1000000 : 1; const value = Math.floor(Number(m[1]) * mult); return Number.isFinite(value) && value >= 0 ? value : null; }
function getPrefixCommandDefinitions() {
    return {
        help: { aliases: ['h'], help: 'Show Auralis prefix command help', usage: '.help [category]' },
        warn: { aliases: ['w', 'warning'], help: 'Warn a member, create a case, send a DM and apply configured warning thresholds', usage: '.warn @user [reason]' },
        ban: { aliases: ['b', 'permaban'], help: 'Ban a member and create a moderation case', usage: '.ban @user [reason]' },
        tempban: { aliases: ['tb'], help: 'Temporarily ban a member; the bot automatically unbans after the duration', usage: '.tempban @user <duration> [reason]' },
        kick: { aliases: ['k'], help: 'Kick a member and create a moderation case', usage: '.kick @user [reason]' },
        punish: { aliases: ['timeout', 'to'], help: 'Timeout a member for a duration', usage: '.punish @user <duration> [reason]' },
        unpunish: { aliases: ['untimeout', 'unto'], help: 'Remove a member timeout', usage: '.unpunish @user [reason]' },
        unban: { aliases: ['ub'], help: 'Unban a user by ID', usage: '.unban <user_id> [reason]' },
        purge: { aliases: ['clear', 'prune'], help: 'Bulk-delete recent messages in the current channel', usage: '.purge <amount>' },
        snipe: { aliases: ['s'], help: 'Show the latest deleted messages' },
        editsnipe: { aliases: ['es'], help: 'Show the latest edited message' },
        reactionsnipe: { aliases: ['rs'], help: 'Show the latest removed reaction' },
        clearsnipe: { aliases: ['cs'], help: 'Clear the snipe cache for this channel', staff: true },
        snipeprotect: { aliases: ['sp'], help: 'Toggle snipe protection', staff: true },
        say: { aliases: ['echo'], help: 'Send the provided message as Auralis; requires staff access', usage: '.say <message>', staff: true },
        '8ball': { aliases: ['ask'], help: 'Give a playful answer to your question', usage: '.8ball <question>' },
        choose: { aliases: ['pick'], help: 'Choose one item from the options you provide', usage: '.choose <option 1> | <option 2> [...]' },
        coinflip: { aliases: ['cf', 'flip'], help: 'Flip a coin' },
        rps: { aliases: ['rockpaperscissors'], help: 'Play rock paper scissors' },
        dice: { aliases: ['roll'], help: 'Roll dice' },
        howgay: { aliases: ['hg'], help: 'Generate a clearly playful compatibility-style percentage for a member' },
        pp: { aliases: ['size'], help: 'Generate a silly, non-serious size percentage for a member' },
        iq: { aliases: ['intelligence'], help: 'Generate a playful IQ-style score for a member' },
        uwuify: { aliases: ['uwu'], help: 'Transform supplied text into a playful uwu-style message', usage: '.uwuify <text>' },
        quote: { aliases: ['q'], help: 'Quote a message or the text you provide', usage: '.quote <message-or-link>' },
        urbandictionary: { aliases: ['ud'], help: 'Look up a term in Urban Dictionary', usage: '.urbandictionary <term>' },
        bible: { aliases: ['verse'], help: 'Show a random Bible verse from the built-in King James Version selection' },
        ship: { aliases: ['compatibility'], help: 'Calculate a deterministic compatibility score' },
        rate: { aliases: ['rating'], help: 'Rate the supplied topic on a playful 0–10 scale', usage: '.rate <topic>' },
        roast: { aliases: ['insult'], help: 'Generate a light, playful roast for a member' },
        rizz: { aliases: ['pickup'], help: 'Generate a playful pickup line for a member' },
        howautistic: { aliases: ['ha'], help: 'Generate a non-serious random percentage; this is only a joke and not a real assessment' },
        hot: { aliases: ['hotcalc'], help: 'Generate a playful hotness rating for a member' },
        simp: { aliases: [], help: 'Generate a playful simp rating for a member' },
        braincells: { aliases: ['brain'], help: 'Generate a silly braincell count for a member' },
        cursed: { aliases: [], help: 'Generate a playful cursed percentage for a member' },
        luck: { aliases: ['lucky'], help: 'Show a playful luck percentage for you' },
        fact: { aliases: ['facts'], help: 'Fetch and share a random general-interest fact' },
        joke: { aliases: ['jokes'], help: 'Fetch and share a random joke' },
        reverse: { aliases: ['rev'], help: 'Reverse the text you provide', usage: '.reverse <text>' },
        mock: { aliases: [], help: 'Transform text into alternating capitalization', usage: '.mock <text>' },
        math: { aliases: ['calc'], help: 'Calculate a mathematical expression using +, -, *, / and parentheses', usage: '.math <expression>' },
        lyrics: { aliases: ['lyric'], help: 'Search for a song’s lyrics using the song title and optional artist', usage: '.lyrics <song>' },
        qr: { aliases: ['qrcode'], help: 'Generate a QR code from the text or URL you provide', usage: '.qr <text-or-url>' },
        balance: { aliases: ['bal', 'wallet'], help: 'Show a wallet balance' },
        bank: { aliases: ['vault'], help: 'Show wallet and bank balance' },
        deposit: { aliases: ['dep'], help: 'Move coins into the bank' },
        withdraw: { aliases: ['wd'], help: 'Move coins out of the bank' },
        bankup: { aliases: ['bankupgrade'], help: 'Increase bank capacity' },
        daily: { aliases: ['claimdaily'], help: 'Claim the daily reward' },
        work: { aliases: ['job'], help: 'Work for coins' },
        give: { aliases: ['pay', 'transfer'], help: 'Send coins to another member' },
        cooldowns: { aliases: ['cd'], help: 'Show active cooldowns' },
        gamble: { aliases: ['bet'], help: 'Gamble coins' },
        rob: { aliases: ['heist'], help: 'Attempt to rob another server member. Success transfers a portion of their wallet; failure may cost you a fine.', usage: '.rob @member' },
        baltop: { aliases: ['richest', 'moneytop'], help: 'Show the server money leaderboard' },
        badges: { aliases: ['badge'], help: 'Show your badges' },
        rollback: { aliases: ['undo'], help: 'Review the latest moderation rollback', staff: true },
        github: { aliases: ['gh'], help: 'Look up a public GitHub profile', usage: '.github <username>' },
        roblox: { aliases: ['rbx'], help: 'Look up a Roblox user profile', usage: '.roblox <username>' },
        rotate: { aliases: [], help: 'Rotate an attached image and return the processed file; defaults to 90 degrees', usage: '.rotate [degrees]' },
        compress: { aliases: [], help: 'Compress an attached image to WebP; quality must be between 20 and 95', usage: '.compress [quality]' },
        invert: { aliases: [], help: 'Invert the colours of an attached image and return a PNG', usage: '.invert' }
    };
}
async function resolvePrefixMember(message, token) {
    const value = String(token ?? '').trim();
    const mention = value.match(/^<@!?(\d{17,20})>$/);
    const id = mention?.[1] ?? (/^\d{17,20}$/.test(value) ? value : null);
    if (id)
        return message.guild.members.fetch(id).catch(() => null);
    if (!value)
        return null;
    const found = await message.guild.members.search({ query: value, limit: 10 }).catch(() => null);
    if (!found?.size)
        return null;
    const normalized = value.toLowerCase();
    return found.find(member => [member.user.username, member.user.globalName, member.displayName, member.user.tag].filter(Boolean).some(name => name.toLowerCase() === normalized))
        ?? found.find(member => [member.user.username, member.displayName].filter(Boolean).some(name => name.toLowerCase().startsWith(normalized)))
        ?? null;
}
async function prefixPermissionDenied(message, permissionName) {
    const permissionMap = {
        moderate: discord_js_1.PermissionFlagsBits.ManageMessages,
        ban: discord_js_1.PermissionFlagsBits.BanMembers,
        kick: discord_js_1.PermissionFlagsBits.KickMembers,
        timeout: discord_js_1.PermissionFlagsBits.ModerateMembers
    };
    const permission = permissionMap[permissionName];
    if (!permission || message.member?.permissions?.has(permission))
        return false;
    await message.reply(`You need the **${permissionName === 'ban' ? 'Ban Members' : permissionName === 'kick' ? 'Kick Members' : permissionName === 'timeout' ? 'Moderate Members' : 'Manage Messages'}** permission to use this command.`).catch(() => { });
    return true;
}
const PREFIX_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const PREFIX_IMAGE_MAX_PIXELS = 40_000_000;
async function processPrefixImage(message, prefix, command, args) {
    const attachment = message.attachments?.first?.();
    if (!attachment) {
        return prefixInputError(message, prefix, command, 'Attach a single image to the same message as the command. Images up to 8 MB are supported; external URLs are not fetched.');
    }
    if (Number(attachment.size || 0) > PREFIX_IMAGE_MAX_BYTES) {
        return prefixInputError(message, prefix, command, 'The uploaded image is larger than 8 MB. Resize it or export it at a lower quality and try again.');
    }
    let attachmentUrl;
    try {
        attachmentUrl = new URL(attachment.url);
    }
    catch {
        attachmentUrl = null;
    }
    if (!attachmentUrl || attachmentUrl.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(attachmentUrl.hostname.toLowerCase())) {
        return prefixInputError(message, prefix, command, 'For safety, image processing only accepts files attached directly to Discord messages.');
    }
    const contentType = String(attachment.contentType || '').toLowerCase();
    const filename = String(attachment.name || '').toLowerCase();
    if ((contentType && !contentType.startsWith('image/')) || (!contentType.startsWith('image/') && !/\.(png|jpe?g|webp|gif|tiff?|avif|bmp)$/i.test(filename))) {
        return prefixInputError(message, prefix, command, 'The attachment does not look like a supported image file. Try PNG, JPEG, WebP, GIF, TIFF, AVIF or BMP.');
    }
    if (command === 'rotate' && (args.length > 1 || (args.length && (!/^-?\d{1,3}$/.test(args[0]) || Math.abs(Number(args[0])) > 360)))) {
        return prefixInputError(message, prefix, command, 'Degrees must be a whole number from -360 to 360. If omitted, the image rotates 90 degrees clockwise.');
    }
    if (command === 'compress' && (args.length > 1 || (args.length && (!/^\d{1,2}$/.test(args[0]) || Number(args[0]) < 20 || Number(args[0]) > 95)))) {
        return prefixInputError(message, prefix, command, 'Quality must be a whole number from 20 to 95. The default is 75; lower values produce smaller files.');
    }
    if (command === 'invert' && args.length) {
        return prefixInputError(message, prefix, command, 'This command does not need extra arguments. Attach an image and use `.invert`.');
    }
    let output;
    let extension;
    try {
        const response = await fetch(attachmentUrl, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
        if (!response.ok)
            throw new Error(`Discord image download failed with HTTP ${response.status}.`);
        const source = Buffer.from(await response.arrayBuffer());
        if (!source.length || source.length > PREFIX_IMAGE_MAX_BYTES)
            throw new Error('The downloaded image is empty or exceeds the 8 MB processing limit.');
        const image = (0, sharp_1.default)(source, { limitInputPixels: PREFIX_IMAGE_MAX_PIXELS, failOn: 'error' });
        const metadata = await image.metadata();
        if (!metadata.width || !metadata.height || metadata.width * metadata.height > PREFIX_IMAGE_MAX_PIXELS) {
            throw new Error('The image dimensions are invalid or too large. Use an image with at most 40 megapixels.');
        }
        if (command === 'rotate') {
            const degrees = Number(args[0] ?? 90);
            output = await image.rotate(degrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 8 }).toBuffer();
            extension = 'png';
        }
        else if (command === 'compress') {
            const quality = Number(args[0] ?? 75);
            output = await image.webp({ quality, effort: 4 }).toBuffer();
            extension = 'webp';
        }
        else {
            output = await image.negate({ alpha: false }).png({ compressionLevel: 8 }).toBuffer();
            extension = 'png';
        }
    }
    catch (error) {
        console.warn(`[Auralis] image command ${prefix}${command} failed: ${(0, core_js_1.cleanError)(error)}`);
        await message.reply({
            embeds: [(0, core_js_1.makeEmbed)({ title: 'Image could not be processed', description: 'I could not read or convert that attachment. Try a standard PNG, JPEG or WebP image under 8 MB and 40 megapixels, then try again.', color: config_js_1.config.brand.warning })],
            allowedMentions: { parse: [] }
        }).catch(() => { });
        return true;
    }
    if (output.length > PREFIX_IMAGE_MAX_BYTES) {
        throw new Error('The processed image is still larger than 8 MB. Try `.compress 55` or upload a smaller original.');
    }
    const outputName = `auralis-${command}-${Date.now()}.${extension}`;
    const attachmentOut = new discord_js_1.AttachmentBuilder(output, { name: outputName });
    await message.reply({
        content: `Image ${command === 'rotate' ? `rotated by ${Number(args[0] ?? 90)}°` : command === 'compress' ? `compressed to WebP (quality ${Number(args[0] ?? 75)})` : 'colour-inverted'} successfully.`,
        files: [attachmentOut],
        allowedMentions: { parse: [] }
    });
    return true;
}
async function prefixInputError(message, prefix, command, problem = '') {
    const definition = getPrefixCommandDefinitions()[command] || {};
    const details = definition.help || 'Check the arguments and try again.';
    const rawUsage = String(definition.usage || `${prefix}${command}`).trim();
    const usage = rawUsage.startsWith('.') ? `${prefix}${rawUsage.slice(1)}` : rawUsage.startsWith(prefix) ? rawUsage : `${prefix}${command} [arguments]`;
    const aliases = Array.isArray(definition.aliases) && definition.aliases.length
        ? `\n\n**Aliases:** ${definition.aliases.map(alias => `\`${prefix}${alias}\``).join(', ')}`
        : '';
    const hint = problem ? `\n\n**What went wrong**\n${(0, core_js_1.truncate)(problem, 700)}` : '\n\nCheck that you supplied each required argument in the order shown below.';
    const description = `${(0, core_js_1.truncate)(details, 500)}\n\n**Correct usage**\n\`${usage}\`${hint}${aliases}\n\nUse \`${prefix}help\` to browse available commands.`;
    await message.reply({ embeds: [(0, core_js_1.makeEmbed)({ title: `Command Help: ${prefix}${command}`, description: (0, core_js_1.truncate)(description, 3900), color: config_js_1.config.brand.warning })] }).catch(() => { });
    return true;
}
async function prefixRequireReasonIfConfigured(message, action, reason, prefix, command) {
    const required = (0, db_js_1.getGuildConfig)(message.guild.id).moderation?.reasonRequiredFor;
    const configured = Array.isArray(required) && required.map(value => String(value).toUpperCase()).includes(String(action).toUpperCase());
    if (!configured || String(reason ?? '').trim())
        return false;
    await prefixInputError(message, prefix, command, `This server requires a reason for ${action}. Add a reason after the target/duration, or ask an administrator to change Dashboard → Moderation → Required reasons.`);
    return true;
}
function prefixCommandDistance(a, b) {
    const left = String(a).toLowerCase();
    const right = String(b).toLowerCase();
    const rows = Array.from({ length: left.length + 1 }, (_, i) => {
        const row = new Array(right.length + 1).fill(0);
        row[0] = i;
        return row;
    });
    for (let j = 0; j <= right.length; j++)
        rows[0][j] = j;
    for (let i = 1; i <= left.length; i++)
        for (let j = 1; j <= right.length; j++) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
                rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
            }
        }
    return rows[left.length][right.length];
}
function closestPrefixCommand(raw, definitions) {
    const candidates = Object.entries(definitions).flatMap(([name, definition]) => [name, ...(definition.aliases || [])].map(alias => ({ alias, name })));
    const ranked = candidates.map(item => ({ ...item, distance: prefixCommandDistance(raw, item.alias) }))
        .filter(item => item.distance <= Math.max(1, Math.floor(String(raw).length * 0.25)))
        .sort((a, b) => a.distance - b.distance || a.alias.length - b.alias.length);
    return ranked[0] || null;
}
async function handlePrefix(message, client, prefix) {
    const body = message.content.slice(prefix.length).trim();
    if (!body)
        return false;
    const parts = body.split(/\s+/);
    const raw = parts.shift().toLowerCase();
    const defs = getPrefixCommandDefinitions();
    let command = raw;
    for (const [k, v] of Object.entries(defs))
        if (k === raw || v.aliases.includes(raw)) {
            command = k;
            break;
        }
    if (!defs[command]) {
        const cfg = (0, db_js_1.getGuildConfig)(message.guild.id);
        const configuredPrefix = String(cfg.discord?.defaultPrefix ?? config_js_1.config.discord.defaultPrefix ?? '.');
        if (prefix !== configuredPrefix)
            return false;
        const cc = cfg.modules?.customcmd === false ? null : db_js_1.db.prepare('SELECT * FROM custom_commands WHERE guild_id=? AND name=?').get(message.guild.id, raw);
        if (!cc) {
            const suggestion = closestPrefixCommand(raw, defs);
            const suggestionLine = suggestion ? `\nDid you mean \`${prefix}${suggestion.alias}\` (\`${prefix}${suggestion.name}\`)?` : '';
            const customState = cfg.modules?.customcmd === false ? ' Custom commands are disabled in this server.' : '';
            const embed = (0, core_js_1.makeEmbed)({ title: 'Command not found', description: `I couldn’t find \`${prefix}${raw}\`.${suggestionLine}\nUse \`${prefix}help\` to browse available commands.${customState}`, color: config_js_1.config.brand.warning });
            await message.reply({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => { });
            return true;
        }
        message.__auralisCustomCommand = true;
        message.__auralisCustomCommandDeleteInvocation = Boolean(cc.delete_invocation);
        if (cc.enabled === 0) {
            await message.reply({ content: 'That custom command is currently disabled.', allowedMentions: { parse: [] } }).catch(() => { });
            return true;
        }
        const roleIds = (() => { try {
            const value = JSON.parse(cc.allowed_role_ids || '[]');
            return Array.isArray(value) ? value.map(String) : [];
        }
        catch {
            return [];
        } })();
        if (roleIds.length && !roleIds.some(id => message.member?.roles?.cache?.has(id))) {
            await message.reply({ content: 'You do not have a role that can use this command.', allowedMentions: { parse: [] } }).catch(() => { });
            return true;
        }
        const required = String(cc.required_permission || 'None');
        if (required !== 'None' && (!discord_js_1.PermissionFlagsBits[required] || !message.member?.permissions?.has(discord_js_1.PermissionFlagsBits[required]))) {
            await message.reply({ content: `You need the **${required}** permission to use this command.`, allowedMentions: { parse: [] } }).catch(() => { });
            return true;
        }
        const cooldownSeconds = Math.max(0, Math.min(3600, Number(cc.cooldown_seconds) || 0));
        if (cooldownSeconds) {
            globalThis.__auralisCustomCommandCooldown ??= new Map();
            const key = `${message.guild.id}:${cc.name}:${message.author.id}`;
            const next = globalThis.__auralisCustomCommandCooldown.get(key) || 0;
            if (next > Date.now()) {
                await message.reply({ content: `Please wait ${Math.ceil((next - Date.now()) / 1000)} seconds before using this command again.`, allowedMentions: { parse: [] } }).catch(() => { });
                return true;
            }
            globalThis.__auralisCustomCommandCooldown.set(key, Date.now() + cooldownSeconds * 1000);
        }
        const placeholders = { user: message.author.toString(), username: message.author.username, server: message.guild.name, channel: message.channel.toString(), author: message.author.toString(), args: parts.join(' '), prefix, memberCount: message.guild.memberCount, userId: message.author.id, guildId: message.guild.id, command: cc.name };
        const rendered = (0, core_js_1.replacePlaceholders)(String(cc.reply || ''), placeholders).slice(0, 1900);
        const embedCfg = (() => { try {
            return JSON.parse(cc.embed_json || '{}');
        }
        catch {
            return {};
        } })();
        let embed = null;
        if (embedCfg.enabled) {
            const description = (0, core_js_1.replacePlaceholders)(String(embedCfg.description || rendered || ''), placeholders).slice(0, 4096);
            embed = new discord_js_1.EmbedBuilder().setColor((0, core_js_1.safeHexColor)(embedCfg.color, config_js_1.config.brand.primary));
            if (embedCfg.title)
                embed.setTitle((0, core_js_1.replacePlaceholders)(String(embedCfg.title), placeholders).slice(0, 256));
            if (description)
                embed.setDescription(description);
            const validUrl = value => { try {
                const u = new URL(String(value));
                return ['https:', 'http:'].includes(u.protocol) ? u.href : null;
            }
            catch {
                return null;
            } };
            const url = validUrl(embedCfg.url);
            if (url)
                embed.setURL(url);
            const authorIcon = validUrl(embedCfg.authorIconUrl);
            if (embedCfg.authorName)
                embed.setAuthor({ name: (0, core_js_1.replacePlaceholders)(String(embedCfg.authorName), placeholders).slice(0, 256), ...(authorIcon ? { iconURL: authorIcon } : {}) });
            const thumbnail = validUrl(embedCfg.thumbnailUrl);
            if (thumbnail)
                embed.setThumbnail(thumbnail);
            const image = validUrl(embedCfg.imageUrl);
            if (image)
                embed.setImage(image);
            const footerIcon = validUrl(embedCfg.footerIconUrl);
            if (embedCfg.footerText)
                embed.setFooter({ text: (0, core_js_1.replacePlaceholders)(String(embedCfg.footerText), placeholders).slice(0, 2048), ...(footerIcon ? { iconURL: footerIcon } : {}) });
            if (embedCfg.timestamp)
                embed.setTimestamp(new Date());
        }
        const content = embed ? undefined : rendered;
        const payload = { ...(content ? { content } : {}), ...(embed ? { embeds: [embed] } : {}), allowedMentions: { parse: [] } };
        const privateResponse = cc.response_mode === 'dm';
        if (privateResponse) {
            const sent = await message.author.send(payload).then(() => true).catch(() => false);
            if (!sent)
                await message.reply({ content: 'I could not send you a private response. Please enable direct messages from server members and try again.', allowedMentions: { parse: [] } }).catch(() => { });
        }
        else if (cc.reply_mode === 'channel')
            await message.channel.send(payload).catch(() => { });
        else
            await message.reply(payload).catch(() => { });
        return true;
    }
    const economyCommandNames = new Set(['balance', 'bank', 'deposit', 'withdraw', 'bankup', 'daily', 'work', 'give', 'gamble', 'rob', 'baltop', 'resetall', 'cooldowns']);
    if (economyCommandNames.has(command)) {
        const ecoCfg = (0, db_js_1.getGuildConfig)(message.guild.id);
        const eco = ecoCfg.economyDefaults ?? {};
        if (ecoCfg.modules?.economy === false || eco.enabled === false) {
            await message.reply('The economy system is disabled in this server.').catch(() => { });
            return true;
        }
        if (command === 'gamble' && eco.gamblingEnabled === false) {
            await message.reply('Gambling is disabled for this server.').catch(() => { });
            return true;
        }
        if (command === 'rob' && eco.robberyEnabled === false) {
            await message.reply('Robbery commands are disabled for this server.').catch(() => { });
            return true;
        }
        if (['give', 'transfer'].includes(command) && eco.transferEnabled === false) {
            await message.reply('Member-to-member transfers are disabled for this server.').catch(() => { });
            return true;
        }
        if (command === 'daily' && eco.dailyEnabled === false) {
            await message.reply('Daily rewards are disabled for this server.').catch(() => { });
            return true;
        }
        if (command === 'work' && eco.workEnabled === false) {
            await message.reply('Work rewards are disabled for this server.').catch(() => { });
            return true;
        }
        if (command === 'baltop' && eco.leaderboardEnabled === false) {
            await message.reply('The economy leaderboard is disabled for this server.').catch(() => { });
            return true;
        }
    }
    if (!(0, db_js_1.prefixCommandEnabled)(message.guild.id, command)) {
        await message.reply('That prefix command is disabled in this server.').catch(() => { });
        return true;
    }
    const args = parts;
    try {
        if (defs[command].staff && !(0, core_js_1.isStaff)(message.member)) {
            await message.reply('You do not have permission to use that command.').catch(() => { });
            return true;
        }
        switch (command) {
            case 'help': {
                const defs = getPrefixCommandDefinitions();
                const names = Object.keys(defs).filter(k => (0, db_js_1.prefixCommandEnabled)(message.guild.id, k));
                const text = names.map(name => `**${prefix}${name}** — ${defs[name].help ?? 'Auralis command'}`).join('\n');
                await message.channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Auralis Prefix Help', description: `Use ${prefix} before a command.\n\n${(0, core_js_1.truncate)(text, 3900)}`, color: config_js_1.config.brand.primary })] });
                return true;
            }
            case 'warn': {
                if (await prefixPermissionDenied(message, 'moderate'))
                    return true;
                const target = await resolvePrefixMember(message, args[0]);
                const reason = args.slice(1).join(' ').trim();
                if (!target)
                    return await prefixInputError(message, prefix, command, 'Mention a current server member or provide their ID.');
                if (await prefixRequireReasonIfConfigured(message, 'WARN', reason, prefix, command))
                    return true;
                const reasonForCase = reason || 'No reason provided.';
                const result = await (0, moderation_js_1.warn)({ guild: message.guild, guildId: message.guild.id, user: message.author, member: message.member, memberPermissions: message.member?.permissions }, target, reasonForCase);
                const delivery = result.dmSent ? 'DM sent' : 'DM not delivered (their DMs may be closed)';
                await message.reply({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Warning Issued', description: `Member: ${target.user}\nCase: **#${result.id}**\nWarning ID: **#${result.warningId}** (use with /unwarn)\nReason: ${(0, core_js_1.truncate)(reasonForCase, 700)}\nActive warnings: **${result.count}**\nNotification: **${delivery}**${result.automaticAction ? `\nAutomatic action: ${result.automaticAction}` : ''}`, color: config_js_1.config.brand.warning })] });
                return true;
            }
            case 'ban': {
                if (await prefixPermissionDenied(message, 'ban'))
                    return true;
                const target = await resolvePrefixMember(message, args[0]);
                const suppliedReason = args.slice(1).join(' ').trim();
                if (!target)
                    return await prefixInputError(message, prefix, command);
                if (await prefixRequireReasonIfConfigured(message, 'BAN', suppliedReason, prefix, command))
                    return true;
                const reason = suppliedReason || 'No reason provided.';
                const result = await (0, moderation_js_1.ban)({ guild: message.guild, guildId: message.guild.id, user: message.author, member: message.member, memberPermissions: message.member?.permissions }, target, reason);
                await message.reply({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Member Banned', description: `Member: <@${target.id}>\nDuration: **Permanent**\nCase: **#${result.id}**\nReason: ${(0, core_js_1.truncate)(reason, 700)}\nMember DM: **${dmDeliveryLabel(result.dmSent)}**`, color: config_js_1.config.brand.danger })] });
                return true;
            }
            case 'tempban': {
                if (await prefixPermissionDenied(message, 'ban'))
                    return true;
                const target = await resolvePrefixMember(message, args[0]);
                const duration = args[1];
                const reason = args.slice(2).join(' ').trim();
                if (!target || !duration)
                    return await prefixInputError(message, prefix, command, 'Supply a current server member and a duration such as 10m, 2h, or 7d. The reason is optional unless configured as required.');
                if (await prefixRequireReasonIfConfigured(message, 'TEMPBAN', reason, prefix, command))
                    return true;
                const reasonForCase = reason || 'No reason provided.';
                const result = await (0, moderation_js_1.tempban)({ guild: message.guild, guildId: message.guild.id, user: message.author, member: message.member, memberPermissions: message.member?.permissions }, target, duration, reasonForCase);
                await message.reply({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Temporary Ban Applied', description: `Member: <@${target.id}>\nDuration: **${(0, core_js_1.formatDuration)(result.durationMs)}**\nExpires: <t:${Math.floor(result.expiresAt / 1000)}:F> (<t:${Math.floor(result.expiresAt / 1000)}:R>)\nCase: **#${result.id}**\nReason: ${(0, core_js_1.truncate)(reasonForCase, 650)}\nMember DM: **${dmDeliveryLabel(result.dmSent)}**`, color: config_js_1.config.brand.danger })] });
                return true;
            }
            case 'kick': {
                if (await prefixPermissionDenied(message, 'kick'))
                    return true;
                const target = await resolvePrefixMember(message, args[0]);
                const suppliedReason = args.slice(1).join(' ').trim();
                if (!target)
                    return await prefixInputError(message, prefix, command);
                if (await prefixRequireReasonIfConfigured(message, 'KICK', suppliedReason, prefix, command))
                    return true;
                const reason = suppliedReason || 'No reason provided.';
                const result = await (0, moderation_js_1.kick)({ guild: message.guild, guildId: message.guild.id, user: message.author, member: message.member, memberPermissions: message.member?.permissions }, target, reason);
                await message.reply({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Member Kicked', description: `Member: <@${target.id}>\nCase: **#${result.id}**\nReason: ${(0, core_js_1.truncate)(reason, 700)}\nMember DM: **${dmDeliveryLabel(result.dmSent)}**`, color: config_js_1.config.brand.warning })] });
                return true;
            }
            case 'punish': {
                if (await prefixPermissionDenied(message, 'timeout'))
                    return true;
                const target = await resolvePrefixMember(message, args[0]);
                const duration = args[1];
                const reason = args.slice(2).join(' ').trim();
                if (!target || !duration)
                    return await prefixInputError(message, prefix, command, 'Supply a current server member and a duration such as 10m, 2h, or 7d. The reason is optional unless configured as required.');
                if (await prefixRequireReasonIfConfigured(message, 'TIMEOUT', reason, prefix, command))
                    return true;
                const reasonForCase = reason || 'No reason provided.';
                const result = await (0, moderation_js_1.timeout)({ guild: message.guild, guildId: message.guild.id, user: message.author, member: message.member, memberPermissions: message.member?.permissions }, target, duration, reasonForCase);
                await message.reply({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Member Timed Out', description: `Member: <@${target.id}>\nDuration: **${(0, core_js_1.formatDuration)(result.durationMs)}**\nExpiry: <t:${Math.floor(result.expiresAt / 1000)}:F> (<t:${Math.floor(result.expiresAt / 1000)}:R>)\nCase: **#${result.id}**\nReason: ${(0, core_js_1.truncate)(reasonForCase, 650)}\nMember DM: **${dmDeliveryLabel(result.dmSent)}**`, color: config_js_1.config.brand.warning })] });
                return true;
            }
            case 'unpunish': {
                if (await prefixPermissionDenied(message, 'timeout'))
                    return true;
                const target = await resolvePrefixMember(message, args[0]);
                if (!target)
                    return await prefixInputError(message, prefix, command);
                const reason = args.slice(1).join(' ').trim();
                if (await prefixRequireReasonIfConfigured(message, 'UNTIMEOUT', reason, prefix, command))
                    return true;
                const reasonForCase = reason || 'Timeout removed by staff';
                const result = await (0, moderation_js_1.untimeout)({ guild: message.guild, guildId: message.guild.id, user: message.author, member: message.member, memberPermissions: message.member?.permissions }, target, reasonForCase);
                await message.reply(`Timeout removed from ${target.user}. Case #${result.id}. Reason: ${reasonForCase}. Member DM: ${dmDeliveryLabel(result.dmSent)}.`);
                return true;
            }
            case 'unban': {
                if (await prefixPermissionDenied(message, 'ban'))
                    return true;
                const userId = String(args[0] ?? '').match(/^\d{17,20}$/)?.[0];
                if (!userId)
                    return await prefixInputError(message, prefix, command);
                const reason = args.slice(1).join(' ').trim();
                if (await prefixRequireReasonIfConfigured(message, 'UNBAN', reason, prefix, command))
                    return true;
                const reasonForCase = reason || 'User unbanned by staff';
                const result = await (0, moderation_js_1.unban)(message.guild, userId, message.author.id, { guild: message.guild, user: message.author, member: message.member, memberPermissions: message.member?.permissions }, reasonForCase);
                await message.reply(`User ID ${userId} was unbanned. Case #${result.id}. Reason: ${reasonForCase}. Member DM: ${dmDeliveryLabel(result.dmSent)}.`);
                return true;
            }
            case 'purge': {
                if (await prefixPermissionDenied(message, 'moderate'))
                    return true;
                const amount = Number(args[0]);
                if (!Number.isInteger(amount) || amount < 1 || amount > 100)
                    return await prefixInputError(message, prefix, command);
                const count = await (0, moderation_js_1.purge)(message.channel, amount);
                const response = await message.channel.send(`Deleted ${count} message${count === 1 ? '' : 's'}.`);
                setTimeout(() => response.delete().catch(() => { }), 5000).unref?.();
                return true;
            }
            case 'snipe': return message.client.__auralisSnipe?.get(message.channel.id)?.slice(0, Number(args[0]) || 1).forEach(x => message.channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Snipe', description: `${x.authorTag}: ${x.content || '[attachment]'}`, color: config_js_1.config.brand.info })] })), true;
            case 'editsnipe': {
                const x = message.client.__auralisEditSnipe?.get(message.channel.id);
                if (x)
                    await message.channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Edit Snipe', description: `${x.authorTag}: ${x.before}\n→ ${x.after}`, color: config_js_1.config.brand.warning })] });
                return true;
            }
            case 'reactionsnipe': {
                const x = message.client.__auralisReactionSnipe?.get(message.channel.id);
                if (x)
                    await message.channel.send({ content: `${x.userTag} removed ${x.emoji}` });
                return true;
            }
            case 'clearsnipe':
                message.client.__auralisSnipe?.delete(message.channel.id);
                message.client.__auralisEditSnipe?.delete(message.channel.id);
                message.client.__auralisReactionSnipe?.delete(message.channel.id);
                return true;
            case 'snipeprotect': {
                const map = message.client.__auralisSnipeProtect ?? (message.client.__auralisSnipeProtect = new Set());
                map.has(message.channel.id) ? map.delete(message.channel.id) : map.add(message.channel.id);
                await message.reply({ content: `Snipe protection ${map.has(message.channel.id) ? 'enabled' : 'disabled'}.` });
                return true;
            }
            case 'say':
                await message.delete().catch(() => { });
                await message.channel.send({ content: args.join(' ') });
                return true;
            case '8ball': {
                const answers = ['Yes.', 'No.', 'Probably.', 'Ask again later.', 'Absolutely.', 'Not a chance.'];
                await message.reply(answers[(0, core_js_1.hashNumber)(body, answers.length)]);
                return true;
            }
            case 'choose': {
                const choices = body.slice(body.indexOf(' ') + 1).split(',').map(x => x.trim()).filter(Boolean);
                await message.reply(choices[(0, core_js_1.hashNumber)(body, Math.max(1, choices.length))] ?? 'Give me some choices.');
                return true;
            }
            case 'coinflip':
                await message.reply((0, community_js_1.coinflip)());
                return true;
            case 'rps': {
                const pick = (args[0] ?? '').toLowerCase();
                if (!['r', 'p', 's'].includes(pick))
                    return await prefixInputError(message, prefix, command);
                const cpu = ['r', 'p', 's'][(0, core_js_1.randomBetween)(0, 2)];
                const result = pick === cpu ? 'Tie' : ((pick === 'r' && cpu === 's') || (pick === 'p' && cpu === 'r') || (pick === 's' && cpu === 'p') ? 'Win' : 'Loss');
                await message.reply(`You: ${pick} — Auralis: ${cpu} — **${result}**`);
                return true;
            }
            case 'dice': {
                const r = (0, community_js_1.dice)(args[0] ?? 6, args[1] ?? 1);
                await message.reply(`${r.rolls.join(', ')} — **${r.total}**`);
                return true;
            }
            case 'howgay':
            case 'pp':
            case 'iq':
            case 'howautistic':
            case 'hot':
            case 'simp':
            case 'cursed': {
                const label = command;
                const target = message.mentions.users.first() ?? message.author;
                const n = (0, community_js_1.jokeScore)(label, target.id);
                await message.reply(`${target} — **${n}%**`);
                return true;
            }
            case 'braincells': {
                const target = message.mentions.users.first() ?? message.author;
                const n = (0, core_js_1.hashNumber)(`brain:${target.id}`, 10001);
                await message.reply(`${target} has **${n}** braincells.`);
                return true;
            }
            case 'luck': {
                const n = (0, community_js_1.jokeScore)('luck', message.author.id);
                await message.reply(`Your luck: **${n}%**`);
                return true;
            }
            case 'fact': {
                const r = await (0, core_js_1.fetchJson)('https://uselessfacts.jsph.pl/api/v2/facts/random');
                await message.reply(r.text);
                return true;
            }
            case 'joke': {
                const r = await (0, core_js_1.fetchJson)('https://official-joke-api.appspot.com/random_joke');
                await message.reply(`${r.setup}\n${r.punchline}`);
                return true;
            }
            case 'reverse':
                await message.reply(args.join(' ').split('').reverse().join(''));
                return true;
            case 'mock': {
                let out = '';
                let upper = false;
                for (const c of args.join(' ')) {
                    if (/[a-z]/i.test(c)) {
                        out += upper ? c.toUpperCase() : c.toLowerCase();
                        upper = !upper;
                    }
                    else
                        out += c;
                }
                await message.reply(out);
                return true;
            }
            case 'math':
            case 'calc': {
                const expr = args.join(' ');
                if (!/^[0-9+*/%().\-^\s]+$/.test(expr))
                    return await prefixInputError(message, prefix, command);
                const val = Function(`"use strict";return (${expr.replace(/\^/g, '**')})`)();
                if (!Number.isFinite(val))
                    return await prefixInputError(message, prefix, command);
                await message.reply(String(val));
                return true;
            }
            case 'github':
            case 'gh': {
                const user = args[0];
                if (!user)
                    return await prefixInputError(message, prefix, command);
                const d = await (0, core_js_1.fetchJson)(`https://api.github.com/users/${encodeURIComponent(user)}`, { headers: { 'User-Agent': 'Auralis' } });
                await message.channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: d.login, description: `${d.bio ?? 'No bio.'}\nRepos: **${d.public_repos}**\nFollowers: **${d.followers}**`, color: config_js_1.config.brand.neutral, thumbnail: d.avatar_url, url: d.html_url })] });
                return true;
            }
            case 'qr': {
                const text = args.join(' ');
                if (!text)
                    return await prefixInputError(message, prefix, command);
                await message.channel.send(`https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=400`);
                return true;
            }
            case 'ship': {
                const u1 = message.mentions.users.first() ?? message.author;
                const u2 = message.mentions.users.at(1) ?? message.author;
                const score = (0, core_js_1.hashNumber)([u1.id, u2.id].sort().join(':'), 101);
                await message.reply(`${u1} + ${u2} = **${score}%**`);
                return true;
            }
            case 'rate': {
                const thing = args.join(' ') || 'that';
                const score = (0, core_js_1.hashNumber)('rate:' + thing, 11);
                await message.reply(`I rate **${thing}** ${score}/10.`);
                return true;
            }
            case 'roast': {
                const target = message.mentions.users.first() ?? message.author;
                const lines = ['That was certainly a decision.', 'I have seen loading screens with more progress.', 'You make chaos look organized.', 'Your timing is impressive in the wrong way.'];
                await message.reply(`${target} ${lines[(0, core_js_1.hashNumber)(target.id, lines.length)]}`);
                return true;
            }
            case 'rizz': {
                const target = message.mentions.users.first() ?? message.author;
                const lines = ['Are you a server restart? Because you just fixed my day.', 'You must be a rare drop, because I did not expect to find you.', 'Are you a patch note? Because I cannot stop reading about you.'];
                await message.reply(`${target} ${lines[(0, core_js_1.hashNumber)('rizz:' + target.id, lines.length)]}`);
                return true;
            }
            case 'hotcalc':
            case 'hot': {
                const target = message.mentions.users.first() ?? message.author;
                const score = (0, community_js_1.jokeScore)('hot', target.id);
                await message.reply(`${target} — Hotness **${score}%**`);
                return true;
            }
            case 'uwuify': {
                const text = args.join(' ');
                if (!text)
                    return await prefixInputError(message, prefix, command);
                await message.reply(text.replace(/r|l/g, 'w').replace(/R|L/g, 'W'));
                return true;
            }
            case 'rob': {
                const eco = economySettings(message.guild.id);
                const target = message.mentions.users.first();
                if (!target)
                    return await prefixInputError(message, prefix, command, `Mention the member you want to rob. Example: ${prefix}rob @Member`);
                if (target.id === message.author.id)
                    return await prefixInputError(message, prefix, command, 'You cannot target yourself. Mention a different member.');
                if (target.bot)
                    return await prefixInputError(message, prefix, command, 'Robbery can only target a real server member, not a bot.');
                const victim = economyRow(message.guild.id, target.id), row = economyRow(message.guild.id, message.author.id);
                if (Date.now() < victim.rob_immunity_until) {
                    await message.reply('That user is protected right now.');
                    return true;
                }
                const maxPercent = Math.max(1, Math.min(100, Number(eco.robberyMaxWalletPercent ?? 33))) / 100;
                const amount = Math.min(Math.floor(victim.wallet * maxPercent), Math.max(0, victim.wallet));
                if (Math.random() < Math.max(0, Math.min(100, Number(eco.robberyWinChancePercent ?? 30))) / 100 && amount > 0) {
                    victim.wallet -= amount;
                    row.wallet += amount;
                    victim.rob_immunity_until = Date.now() + Math.max(1, Number(eco.robberyCooldownMinutes ?? 15)) * 60000;
                    saveEconomy(victim);
                    saveEconomy(row);
                    await message.reply(`You robbed **${economyMoney(message.guild.id, amount)}** from ${target}.`);
                }
                else {
                    const fine = Math.min(row.wallet, Math.max(0, Math.floor(row.wallet * Math.max(0, Math.min(100, Number(eco.robberyFailFinePercent ?? 5))) / 100)));
                    row.wallet -= fine;
                    saveEconomy(row);
                    await message.reply(`The robbery failed. You paid **${economyMoney(message.guild.id, fine)}**.`);
                }
                return true;
            }
            case 'howautistic': {
                const target = message.mentions.users.first() ?? message.author;
                await message.reply(`${target} — **${(0, community_js_1.jokeScore)('autistic', target.id)}%**`);
                return true;
            }
            case 'luck': {
                const n = (0, community_js_1.jokeScore)('luck', message.author.id);
                await message.reply(`Your luck: **${n}%**`);
                return true;
            }
            case 'joke': {
                const r = await (0, core_js_1.fetchJson)('https://official-joke-api.appspot.com/random_joke');
                await message.reply(`${r.setup}\n${r.punchline}`);
                return true;
            }
            case 'badges':
                await message.reply('Auralis badges are computed from configured server activity, XP, verification and account signals.');
                return true;
            case 'quote': {
                const msgId = (args[0] || '').match(/\d{17,20}$/)?.[0];
                if (!msgId)
                    return await prefixInputError(message, prefix, command);
                const q = await message.channel.messages.fetch(msgId).catch(() => null);
                if (!q)
                    return await prefixInputError(message, prefix, command);
                await message.channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Quote', description: q.cleanContent || '[embed/attachment]', color: config_js_1.config.brand.neutral, thumbnail: q.author.displayAvatarURL() })] });
                return true;
            }
            case 'urbandictionary':
            case 'ud': {
                const term = args.join(' ');
                if (!term)
                    return await prefixInputError(message, prefix, command);
                const r = await (0, core_js_1.fetchJson)(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
                const d = r.list?.[0];
                if (!d)
                    return await prefixInputError(message, prefix, command);
                await message.channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: term, description: (0, core_js_1.truncate)(String(d.definition).replace(/\[/g, '').replace(/\]/g, ''), 3500), color: config_js_1.config.brand.warning })] });
                return true;
            }
            case 'bible': {
                const verses = [{ ref: 'Psalm 23:1', text: 'The LORD is my shepherd; I shall not want.' }, { ref: 'Proverbs 3:5', text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.' }, { ref: 'Matthew 5:9', text: 'Blessed are the peacemakers: for they shall be called the children of God.' }, { ref: 'John 3:16', text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' }, { ref: 'Philippians 4:13', text: 'I can do all things through Christ which strengtheneth me.' }, { ref: 'Joshua 1:9', text: 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.' }, { ref: 'Romans 8:28', text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' }, { ref: '1 Corinthians 13:4', text: 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up.' }, { ref: 'Psalm 46:1', text: 'God is our refuge and strength, a very present help in trouble.' }, { ref: 'Micah 6:8', text: 'He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?' }];
                const verse = verses[(0, core_js_1.randomBetween)(0, verses.length - 1)];
                await message.reply({ embeds: [(0, core_js_1.makeEmbed)({ title: `Random Bible Verse · ${verse.ref}`, description: verse.text, color: config_js_1.config.brand.info })] });
                return true;
            }
            case 'lyrics': {
                const q = args.join(' ');
                if (!q)
                    return await prefixInputError(message, prefix, command);
                const d = await (0, core_js_1.fetchJson)(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
                const song = d?.[0];
                if (!song)
                    return await prefixInputError(message, prefix, command);
                await message.channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: `${song.trackName ?? q} — ${song.artistName ?? ''}`, description: (0, core_js_1.truncate)(song.plainLyrics ?? song.syncedLyrics ?? 'No lyrics found.', 3500), color: config_js_1.config.brand.info })] });
                return true;
            }
            case 'rotate':
            case 'compress':
            case 'invert': return await processPrefixImage(message, prefix, command, args);
            case 'balance':
            case 'bal': {
                const target = message.mentions.users.first() ?? message.author;
                const row = economyRow(message.guild.id, target.id);
                const response = economyResponse(message.guild.id, 'balance', '{user} — Wallet: {wallet} {currency}', { user: target.toString(), wallet: row.wallet });
                await message.reply(response);
                return true;
            }
            case 'bank': {
                const target = message.mentions.users.first() ?? message.author;
                const row = economyRow(message.guild.id, target.id);
                const response = economyResponse(message.guild.id, 'bank', '{user} — Wallet: {wallet} {currency} · Bank: {bank}/{bankCap} {currency}', { user: target.toString(), wallet: row.wallet, bank: row.bank, bankCap: row.bank_cap });
                await message.reply(response);
                return true;
            }
            case 'deposit':
            case 'dep': {
                const row = economyRow(message.guild.id, message.author.id);
                const n = Math.min(row.wallet, parseCoinAmount(args[0], row) ?? 0, Math.max(0, row.bank_cap - row.bank));
                if (!n)
                    return await prefixInputError(message, prefix, command);
                row.wallet -= n;
                row.bank += n;
                saveEconomy(row);
                await message.reply(economyResponse(message.guild.id, 'deposit', 'Deposited {amount} {currency}. Bank: {bank}/{bankCap} {currency}.', { amount: n, bank: row.bank, bankCap: row.bank_cap, user: message.author.toString() }));
                return true;
            }
            case 'withdraw':
            case 'wd': {
                const row = economyRow(message.guild.id, message.author.id);
                const requested = args[0] === 'all' || args[0] === 'max' ? row.bank : parseCoinAmount(args[0], { ...row, wallet: row.bank });
                const n = Math.min(row.bank, requested ?? 0);
                if (!n)
                    return await prefixInputError(message, prefix, command);
                row.bank -= n;
                row.wallet += n;
                saveEconomy(row);
                await message.reply(economyResponse(message.guild.id, 'withdraw', 'Withdrew {amount} {currency}. Wallet: {wallet} {currency}.', { amount: n, wallet: row.wallet, user: message.author.toString() }));
                return true;
            }
            case 'bankup':
            case 'bankupgrade': {
                const eco = economySettings(message.guild.id);
                const row = economyRow(message.guild.id, message.author.id);
                const cost = Math.ceil(row.bank_cap * Math.max(0.05, Math.min(100, Number(eco.bankUpgradeCostMultiplier ?? 0.5))));
                if (row.wallet < cost)
                    return message.reply(`You need **${economyMoney(message.guild.id, cost)}**.`), true;
                row.wallet -= cost;
                row.bank_cap = Math.floor(row.bank_cap * Math.max(1.05, Math.min(10, Number(eco.bankUpgradeCapacityMultiplier ?? 1.5))));
                saveEconomy(row);
                await message.reply(`Bank capacity increased to **${economyMoney(message.guild.id, row.bank_cap)}**.`);
                return true;
            }
            case 'daily': {
                const eco = economySettings(message.guild.id);
                const row = economyRow(message.guild.id, message.author.id);
                if (Date.now() < row.daily_at)
                    return message.reply(`Daily ready <t:${Math.floor(row.daily_at / 1000)}:R>.`), true;
                row.daily_streak = eco.dailyStreakEnabled === false ? 1 : row.daily_streak + 1;
                const min = Math.max(0, Number(eco.dailyMin ?? 250));
                const max = Math.max(min, Number(eco.dailyMax ?? 350));
                const streakBonus = eco.dailyStreakEnabled === false ? 0 : Math.min(Math.max(0, Number(eco.dailyStreakBonusCap ?? 325)), row.daily_streak * Math.max(0, Number(eco.dailyStreakBonus ?? 25)));
                const amount = (0, core_js_1.randomBetween)(Math.floor(min), Math.floor(max)) + Math.floor(streakBonus);
                row.wallet += amount;
                row.daily_at = Date.now() + Math.max(1, Math.min(8760, Number(eco.dailyCooldownHours ?? 24))) * 3600000;
                saveEconomy(row);
                await message.reply(economyResponse(message.guild.id, 'daily', 'Daily reward: +{amount} {currency}. Streak: {streak}. Next claim {next}.', { user: message.author.toString(), amount, streak: row.daily_streak, next: `<t:${Math.floor(row.daily_at / 1000)}:R>` }));
                return true;
            }
            case 'work': {
                const eco = economySettings(message.guild.id);
                const row = economyRow(message.guild.id, message.author.id);
                if (Date.now() < row.work_at)
                    return message.reply(`Work ready <t:${Math.floor(row.work_at / 1000)}:R>.`), true;
                const min = Math.max(0, Number(eco.workMin ?? 60));
                const max = Math.max(min, Number(eco.workMax ?? 220));
                const amount = (0, core_js_1.randomBetween)(Math.floor(min), Math.floor(max));
                row.wallet += amount;
                row.work_at = Date.now() + Math.max(1, Math.min(10080, Number(eco.workCooldownMinutes ?? 30))) * 60000;
                saveEconomy(row);
                await message.reply(economyResponse(message.guild.id, 'work', 'You earned {amount} {currency}. Next work {next}.', { user: message.author.toString(), amount, next: `<t:${Math.floor(row.work_at / 1000)}:R>` }));
                return true;
            }
            case 'give':
            case 'pay':
            case 'transfer': {
                const target = message.mentions.users.first();
                if (!target || target.bot || target.id === message.author.id)
                    return await prefixInputError(message, prefix, command);
                const eco = economySettings(message.guild.id);
                const row = economyRow(message.guild.id, message.author.id);
                const amount = parseCoinAmount(args.find(x => /^\d|^(?:all|half|max)$/i.test(x)), row);
                if (!amount || amount <= 0 || amount > row.wallet || amount > Math.max(0, Number(eco.transferMax ?? 100000000)))
                    return await prefixInputError(message, prefix, command);
                const tax = Math.floor(amount * Math.max(0, Math.min(100, Number(eco.transferTaxPercent ?? 0))) / 100);
                const to = economyRow(message.guild.id, target.id);
                row.wallet -= amount;
                to.wallet += amount - tax;
                saveEconomy(row);
                saveEconomy(to);
                await message.reply(economyResponse(message.guild.id, 'transfer', 'Sent {amount} {currency} to {target}. {tax} {currency} transfer fee.', { user: message.author.toString(), amount: amount - tax, target: target.toString(), tax }));
                return true;
            }
            case 'gamble': {
                const eco = economySettings(message.guild.id);
                const row = economyRow(message.guild.id, message.author.id);
                const amount = parseCoinAmount(args[0], row);
                if (!amount || amount <= 0 || amount > row.wallet)
                    return await prefixInputError(message, prefix, command);
                if (Math.random() < Math.max(0, Math.min(100, Number(eco.gamblingWinChancePercent ?? 48))) / 100) {
                    row.wallet += amount;
                    saveEconomy(row);
                    await message.reply(`You won **${economyMoney(message.guild.id, amount)}**.`);
                }
                else {
                    row.wallet -= amount;
                    saveEconomy(row);
                    await message.reply(`You lost **${economyMoney(message.guild.id, amount)}**.`);
                }
                return true;
            }
            case 'baltop':
            case 'richest': {
                const key = economyStorageGuildId(message.guild.id);
                const rows = db_js_1.db.prepare('SELECT user_id,wallet+bank AS total FROM economy_accounts WHERE guild_id=? ORDER BY total DESC LIMIT 10').all(key);
                await message.channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: `Balance Leaderboard · ${economyCurrency(message.guild.id)}`, description: rows.map((r, n) => `${n + 1}. <@${r.user_id}> — **${economyMoney(message.guild.id, r.total)}**`).join('\n') || 'No balances yet.', color: config_js_1.config.brand.success })] });
                return true;
            }
            case 'resetall':
            case 'wipecoins':
            case 'ecoreset': {
                const eco = economySettings(message.guild.id);
                const globalScope = String(eco.scope).toLowerCase() === 'global';
                const globalOwner = Boolean(config_js_1.config.dashboardAccess?.owners?.[String(message.author.id)]);
                const authorised = globalScope ? globalOwner : (0, core_js_1.isStaff)(message.member);
                if (!authorised || eco.staffResetEnabled === false)
                    return await prefixInputError(message, prefix, command);
                const key = economyStorageGuildId(message.guild.id);
                db_js_1.db.prepare('DELETE FROM economy_accounts WHERE guild_id=?').run(key);
                await message.reply(globalScope ? 'The global economy balances have been reset by an authorised Auralis owner.' : 'The economy balances for this server have been reset.');
                return true;
            }
            case 'cooldowns':
            case 'cd': {
                const row = economyRow(message.guild.id, message.author.id);
                const d = [];
                if (row.daily_at > Date.now())
                    d.push(`daily <t:${Math.floor(row.daily_at / 1000)}:R>`);
                if (row.work_at > Date.now())
                    d.push(`work <t:${Math.floor(row.work_at / 1000)}:R>`);
                await message.reply(d.join(' — ') || 'No active cooldowns.');
                return true;
            }
            case 'blackjack':
            case 'bj':
            case 'roulette':
            case 'roul':
            case 'slots':
            case 'spin':
            case 'mines':
            case 'crash':
            case 'towers':
            case 'tower':
            case 'connect4':
            case 'c4':
            case 'tictactoe':
            case 'ttt': {
                await message.reply('Game module initialized. Interactive game boards are available through Auralis modules; this command is reserved for the game session.');
                return true;
            }
            default:
                await message.reply('This command is registered but not available in this configuration. Use the help command to see currently supported commands.').catch(() => { });
                return true;
        }
    }
    catch (error) {
        console.warn(`[Auralis] prefix command ${prefix}${command} failed:`, (0, core_js_1.cleanError)(error));
        const definition = defs[command] || {};
        const rawUsage = String(definition.usage || `${prefix}${command} [arguments]`).trim();
        const usage = rawUsage.startsWith('.') ? `${prefix}${rawUsage.slice(1)}` : rawUsage.startsWith(prefix) ? rawUsage : `${prefix}${command} [arguments]`;
        const description = `Something went wrong while I was processing this command. This is not necessarily an argument error; it may be a temporary issue or a missing Discord permission.

**Correct usage**
\`${usage}\`

Use \`${prefix}help\` to browse commands. If the problem keeps happening, ask a server administrator to check the Auralis logs.`;
        await message.reply({ embeds: [(0, core_js_1.makeEmbed)({ title: `Couldn’t complete ${prefix}${command}`, description: (0, core_js_1.truncate)(description, 3900), color: config_js_1.config.brand.warning })], allowedMentions: { parse: [] } }).catch(() => { });
        return true;
    }
}

});
__factories.set("src/config.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.cloneDefaults = cloneDefaults;
const purple = '#7C6CF5';
const blue = '#4D9CFF';
const green = '#56D68A';
const red = '#F36B7F';
const yellow = '#F4C95D';
const gray = '#98A1B3';
exports.config = {
    brand: {
        name: 'Auralis',
        shortName: 'Auralis',
        description: 'A clean, modern Discord support and community management bot.',
        logoUrl: '/auralis-logo.png',
        primary: 0x7C6CF5,
        success: 0x56D68A,
        danger: 0xF36B7F,
        warning: 0xF4C95D,
        info: 0x4D9CFF,
        neutral: 0x98A1B3,
        embedFooter: false,
        embedFooterText: 'Auralis'
    },
    discord: {
        defaultPrefix: '.',
        installUrl: '',
        allowedPrefixes: ['.', '!', '?'],
        prefixes: [],
        commandMentionFallback: true,
        registerGuildCommandsInDevGuild: true,
        deletePrefixCommands: false,
        intents: { members: true, messages: true, reactions: true, voiceStates: true, messageContent: true },
        requiredBotPermissions: [
            'ViewChannel', 'SendMessages', 'SendMessagesInThreads', 'EmbedLinks', 'ReadMessageHistory', 'ManageMessages',
            'ManageChannels', 'ManageRoles', 'ModerateMembers', 'KickMembers', 'BanMembers', 'ViewAuditLog', 'AddReactions',
            'AttachFiles', 'ManageWebhooks', 'ManageThreads', 'CreatePublicThreads', 'CreatePrivateThreads', 'CreateInstantInvite',
            'Connect', 'MoveMembers', 'MuteMembers', 'DeafenMembers'
        ]
    },
    dashboard: {
        enabled: true,
        port: 3000,
        sessionDays: 7,
        scopes: ['identify', 'guilds'],
        allowManageGuildPermission: true,
        requireAdministratorForSetup: false,
        invitePermissions: '1495484460247',
        oauthStateMinutes: 10,
        maxGuildsPerUser: 500
    },
    dashboardPreferences: {
        locale: 'en-GB',
        timeZone: 'Europe/Berlin',
        compactTables: false,
        confirmDestructiveActions: true,
        contentDensity: 'comfortable',
        refreshIntervalSeconds: 5,
        defaultDashboardPage: 'overview'
    },
    database: {
        file: './Data/auralis.sqlite',
        busyTimeout: 5000,
        journalMode: 'WAL',
        cacheSizeKb: -32000,
        synchronous: 'NORMAL'
    },
    limits: {
        maxWarningsShown: 25,
        maxCasesShown: 50,
        maxTranscriptMessages: 500,
        maxTicketNameLength: 90,
        maxCustomCommands: 500,
        maxTags: 250,
        maxPrefixCommandLength: 1900,
        maxAutomodTriggers: 100,
        maxGiveawayWinners: 25,
        maxPollOptions: 5,
        maxStickyLength: 1900,
        maxCustomEmbeds: 500,
        maxFileExtensions: 100,
        maxMessageCachePerChannel: 50
    },
    antiRaid: {
        enabled: true,
        joinWindowSeconds: 20,
        maxJoins: 6,
        action: 'verify_lockdown',
        lockdownMinutes: 5,
        accountAgeDays: 3,
        minVerificationLevel: 2,
        logEvents: true,
        ignoreBots: true,
        ignoreWhitelisted: true,
        duplicateAvatarDetection: false,
        verificationChannelId: null
    },
    antinuke: {
        enabled: true,
        action: 'strip_and_alert',
        windowMs: 10000,
        maxActions: 3,
        modules: { channel: true, role: true, ban: true, kick: true, botAdd: true, webhook: true },
        ownerBypass: true,
        whitelist: []
    },
    automodDefaults: {
        enabled: true,
        notifyUser: true,
        publicNotice: false,
        exemptRoleIds: [],
        exemptUserIds: [],
        exemptChannelIds: [],
        antiPingSpam: { enabled: true, maxMentions: 5, action: 'timeout', durationSeconds: 300, deleteMessage: true },
        antiLink: { enabled: false, allowDiscord: true, allowList: [], blockedDomains: [], blockAdvertising: false, advertisingKeywords: ['free nitro', 'steam nitro', 'join my server', 'server invite', 'cheap nitro', 'giveaway nitro'], action: 'delete', durationSeconds: 300, deleteMessage: true, exemptRoleIds: [], exemptUserIds: [], exemptChannelIds: [] },
        caps: { enabled: false, minChars: 12, percent: 75, action: 'delete', deleteMessage: true },
        invites: { enabled: true, action: 'delete', deleteMessage: true },
        massMention: { enabled: true, maxMentions: 5, maxEveryone: 1, action: 'timeout', durationSeconds: 300, deleteMessage: true },
        emojiSpam: { enabled: false, maxEmojis: 12, action: 'delete', deleteMessage: true },
        messageRate: { enabled: false, messages: 7, windowSeconds: 6, action: 'timeout', durationSeconds: 60, deleteMessage: true },
        bannedWords: { enabled: false, words: [], action: 'delete', deleteMessage: true, exemptRoleIds: [], exemptUserIds: [], exemptChannelIds: [] },
        spoilers: { enabled: false, action: 'delete', deleteMessage: true },
        imageSpam: { enabled: false, maxImages: 4, action: 'delete', deleteMessage: true },
        duplicateText: { enabled: false, windowSeconds: 30, action: 'delete', deleteMessage: true },
        maxCharacters: { enabled: false, max: 1800, action: 'delete', deleteMessage: true },
        maxLines: { enabled: false, max: 12, action: 'delete', deleteMessage: true },
        fileBlock: {
            enabled: true,
            blockedExtensions: ['exe', 'msi', 'com', 'bat', 'cmd', 'scr', 'pif', 'vbs', 'vbe', 'js', 'jse', 'ws', 'wsh', 'ps1', 'psm1', 'jar', 'apk', 'dmg'],
            action: 'delete', deleteMessage: true
        },
        channels: {},
        triggers: []
    },
    automodMessages: {
        blocked: 'Your message was removed by AutoMod.',
        warning: 'Please slow down and follow the server rules.',
        timeout: 'You have been timed out by AutoMod.',
        fileBlocked: 'This file type is not allowed here.',
        linkBlocked: 'Links are not allowed here.',
        inviteBlocked: 'Invites are not allowed here.',
        mentionBlocked: 'Too many mentions.'
    },
    economyDefaults: {
        enabled: true,
        scope: 'server',
        currencyName: 'Coins',
        currencySymbol: '',
        startingWallet: 0,
        startingBank: 0,
        bankCapacity: 1000,
        bankUpgradeCostMultiplier: 0.5,
        bankUpgradeCapacityMultiplier: 1.5,
        dailyEnabled: true,
        dailyMin: 250,
        dailyMax: 350,
        dailyCooldownHours: 24,
        dailyStreakEnabled: true,
        dailyStreakBonus: 25,
        dailyStreakBonusCap: 325,
        workEnabled: true,
        workMin: 60,
        workMax: 220,
        workCooldownMinutes: 30,
        transferEnabled: true,
        transferTaxPercent: 0,
        transferMax: 100000000,
        gamblingEnabled: true,
        gamblingWinChancePercent: 48,
        robberyEnabled: true,
        robberyWinChancePercent: 30,
        robberyMaxWalletPercent: 33,
        robberyCooldownMinutes: 15,
        robberyFailFinePercent: 5,
        leaderboardEnabled: true,
        staffResetEnabled: true,
        commandResponses: {
            balance: '{user} — Wallet: {wallet} {currency}',
            bank: '{user} — Wallet: {wallet} {currency} · Bank: {bank}/{bankCap} {currency}',
            daily: 'Daily reward: +{amount} {currency}. Streak: {streak}.',
            work: 'You earned {amount} {currency}.',
            deposit: 'Deposited {amount} {currency}.',
            withdraw: 'Withdrew {amount} {currency}.',
            transfer: 'Sent {amount} {currency} to {target}.'
        }
    },
    channelPolicies: {
        allowRoleOverrides: true,
        channelOverrides: {},
        fileExtensionsByChannel: {},
        imageOnlyChannels: [],
        stickyChannels: []
    },
    ticketDefaults: {
        enabled: true,
        categoryId: null,
        supportRoleIds: [],
        managerRoleIds: [],
        transcriptChannelId: null,
        logChannelId: null,
        panelChannelId: null,
        panelTitle: 'Support Center',
        panelDescription: 'Choose a category below and Auralis will create a private ticket.',
        creationForm: { enabled: false, title: 'New support ticket', questions: [{ id: 'help', label: 'What do you need help with?', required: true, maxLength: 500 }, { id: 'details', label: 'Additional details', required: false, maxLength: 500 }] },
        panelColor: purple,
        naming: 'ticket-{number}',
        closeDelaySeconds: 3,
        autoTranscript: true,
        closeDmEnabled: true,
        dmTranscriptOnClose: false,
        closeDmTitle: 'Ticket Closed',
        closeDmMessage: 'Your ticket in {server} has been closed by {closedBy}. If you still need help, you can open a new ticket.',
        closeLogTitle: 'Ticket Closed',
        transcriptTitle: 'Ticket Transcript',
        maxOpenPerUser: 2,
        allowUserClose: true,
        claimEnabled: true,
        categories: {
            support: { label: 'Support', emoji: null, style: 'Primary', description: 'Tell the support team what you need help with.' }
        },
        closeTranscriptAsFile: true,
        buttonLabels: { add: 'Add member', remove: 'Remove member', claim: 'Claim ticket', close: 'Close', closeWithReason: 'Close with reason' },
        panelLimits: { minPanels: 1, maxPanels: 500, minComponents: 1, maxComponents: 25, maxRows: 5, maxButtonsPerRow: 5, maxSelectsPerRow: 1, maxOptionsPerSelect: 25 },
        panels: [
            {
                id: 'default',
                name: 'Default',
                enabled: true,
                channelId: null,
                title: 'Support Center',
                description: 'Choose a category below and Auralis will create a private ticket.',
                components: [
                    { id: 'support', type: 'button', label: 'Support', emoji: null, style: 'PRIMARY', action: 'create_ticket', ticketType: 'support', row: 0 }
                ]
            }
        ]
    },
    staffActivityDefaults: {
        enabled: true,
        autoSendEnabled: true,
        intervalHours: 168,
        responseWindowHours: 48,
        windowDays: 30,
        inactivityDays: 7,
        minimumActions: 3,
        minimumTicketCloses: 1,
        channelId: null,
        staffRoleIds: [],
        excludedRoleIds: [],
        mentionRoleId: null,
        panelTitle: 'Staff Activity Check',
        panelDescription: 'Staff confirmation is required. Review the requirements below and confirm that you are active and available.',
        buttonLabel: "I'm Active",
        confirmedTitle: 'Activity Confirmed',
        confirmedDescription: 'Your response has been recorded. You are marked as active for this staff activity check.',
        missingTitle: 'Staff Activity Audit',
        automaticPin: false
    },
    applicationDefaults: {
        enabled: false,
        channelId: null,
        reviewChannelId: null,
        reviewRoleIds: [],
        dmOnDecision: true,
        dmOnSubmission: true,
        cooldownHours: 48,
        forms: {},
        panelSets: {}
    },
    moderation: {
        dmBeforeAction: true,
        caseLogging: true,
        reasonRequiredFor: [],
        deleteCommandMessage: false,
        maxTimeoutDays: 28,
        thresholdEnabled: true,
        thresholds: {
            warningsToTimeout: 3,
            warningsToKick: 5,
            warningsToTempban: 7,
            warningsToBan: 10
        },
        thresholdActions: {
            timeoutDuration: '1h',
            tempbanDuration: '7d'
        },
        responseTemplates: {
            warn: '**Warning issued**\nMember: {user}\nWarning ID: **#{warningId}** (use `/unwarn warning_id:{warningId}` to reverse it)\nCase: **#{caseId}**\nReason: {reason}\nActive warnings: **{activeWarnings}** / {totalWarnings} recorded\nMember DM: {dmStatus}\n{automaticAction}',
            unwarn: '**Warning removed**\nMember: {user}\nWarning ID: **#{warningId}**\nReason: {reason}\nThe historical case remains in the audit history.\nMember DM: {dmStatus}',
            clearwarnings: '**Active warnings cleared**\nMember: {user}\nWarnings cleared: **{warningCount}**\nReason: {reason}\nHistorical records were retained.\nMember DM: {dmStatus}',
            pardon: '**Pardon completed**\nMember: {user}\nActive warnings cleared: **{warningCount}**\nReason: {reason}\nHistorical cases remain available.\nMember DM: {dmStatus}',
            ban: '**Permanent ban applied**\nMember: {user} (`{userId}`)\nCase: **#{caseId}**\nReason: {reason}\nMember DM: {dmStatus}',
            tempban: '**Temporary ban applied**\nMember: {user} (`{userId}`)\nCase: **#{caseId}**\nDuration: **{duration}**\nExpires: {expiresAt} ({expiresRelative})\nReason: {reason}\nMember DM: {dmStatus}',
            kick: '**Member kicked**\nMember: {user} (`{userId}`)\nCase: **#{caseId}**\nReason: {reason}\nMember DM: {dmStatus}',
            mute: '**Discord timeout applied**\nMember: {user} (`{userId}`)\nCase: **#{caseId}**\nDuration: **{duration}**\nExpires: {expiresAt} ({expiresRelative})\nReason: {reason}\nMember DM: {dmStatus}',
            unmute: '**Discord timeout removed**\nMember: {user} (`{userId}`)\nCase: **#{caseId}**\nMember DM: {dmStatus}',
            unban: '**Ban removed**\nUser: {user} (`{userId}`)\nCase: **#{caseId}**\nMember DM: {dmStatus}'
        }
    },
    giveawayDefaults: {
        enabled: true,
        defaultColor: 0x7C6CF5,
        title: 'Giveaway',
        endedTitle: 'Giveaway Ended',
        cancelledTitle: 'Giveaway Cancelled',
        prizeLabel: 'Prize',
        winnersLabel: 'Winners',
        endsLabel: 'Ends',
        hostLabel: 'Hosted by',
        entriesLabel: 'Entries',
        endedLabel: 'Ended',
        entryButtonLabel: 'Enter Giveaway',
        enteredButtonLabel: 'Entered',
        endedButtonLabel: 'Ended',
        minAccountAgeDays: 0,
        minServerAgeDays: 0,
        requiredRoleIds: [],
        description: 'Click below to enter.',
        winnerMessage: 'Congratulations {users}! You won **{prize}**.',
        defaultWinners: 1,
        defaultDuration: '24h',
        minimumServerAgeDays: 0
    },
    pollDefaults: {
        enabled: true,
        title: 'Poll',
        description: 'Select an option below to cast your vote.',
        defaultColor: 0x7C6CF5,
        endedTitle: 'Poll Ended',
        entriesLabel: 'Entries',
        endsLabel: 'Ends',
        hostLabel: 'Hosted by',
        optionLabels: ['A', 'B', 'C', 'D', 'E'],
        allowAnonymous: false,
        allowMultiple: false,
        showCounts: true,
        defaultDuration: '24h',
        closeButtonLabel: 'Close Poll',
        endedButtonLabel: 'Poll Ended',
        allowCreatorClose: true
    },
    levelDefaults: {
        enabled: false,
        xpPerMessageMin: 10,
        xpPerMessageMax: 20,
        cooldownSeconds: 60,
        levelFormulaBase: 100,
        levelFormulaMultiplier: 50,
        stackRoles: true,
        announceChannelId: null,
        announceMessage: '{user} reached Level {level}.',
        rewards: {}
    },
    loggingDefaults: {
        enabled: true,
        channels: {
            moderation: null,
            audit: null,
            messages: null,
            members: null,
            tickets: null,
            applications: null,
            automod: null,
            antinuke: null,
            antiraid: null,
            threads: null,
            giveaways: null,
            reactions: null,
            voice: null,
            boosts: null,
            emojis: null,
            stickers: null,
            scheduledEvents: null,
            guildUpdates: null,
            roles: null,
            channels: null,
            webhooks: null,
            invites: null,
            server: null
        },
        events: {
            timeouts: true,
            bans: true,
            kicks: true,
            deletedMessages: true,
            editedMessages: true,
            joins: true,
            leaves: true,
            purges: true,
            roles: true,
            channels: true,
            webhooks: true,
            antinuke: true,
            nicknames: true,
            memberRoles: true,
            voice: true,
            reactionRoles: true,
            applications: true,
            tickets: true,
            giveaways: true,
            threads: true,
            invites: true,
            boosts: true,
            emojis: true,
            stickers: true,
            scheduledEvents: true,
            guildUpdates: true,
            antiraid: true,
            automod: true
        },
        deletedMessagePreview: true,
        editedMessagePreview: true,
        includeAvatar: true,
        includeLinks: true
    },
    welcomeDefaults: {
        welcomeEnabled: false,
        welcomeChannelId: null,
        mode: 'image',
        welcomeMessage: 'Welcome {user} to {server}.',
        welcomeTitle: 'Welcome {username}',
        welcomeColor: purple,
        messageUseEmbed: false,
        goodbyeEnabled: false,
        goodbyeChannelId: null,
        goodbyeMessage: '{user} left {server}.',
        goodbyeTitle: 'Goodbye',
        goodbyeColor: red,
        autoroles: [],
        designer: {
            enabled: true,
            canvas: { width: 1024, height: 341 },
            background: { color: '#09090D', assetId: null, assetPath: null, fit: 'cover', opacity: 1, gradient: { enabled: true, from: '#09090D', to: '#17152D', direction: '135deg' }, stars: { enabled: true, count: 58, color: '#FFFFFF', opacity: 0.42, seed: 714 } },
            overlay: { enabled: false, color: '#000000', opacity: 0.15 },
            border: { width: 4, color: '#7C6CF5', radius: 0 },
            elements: [
                { id: 'welcome-title', type: 'text', content: 'WELCOME {username}', x: 300, y: 76, width: 650, height: 76, fontSize: 50, fontFamily: 'Impact', fontWeight: 800, color: '#FFFFFF', align: 'left', opacity: 1, rotation: 0, shadow: true, visible: true, zIndex: 20 },
                { id: 'welcome-subtitle', type: 'text', content: 'YOU ARE THE {member_ordinal} MEMBER!', x: 300, y: 156, width: 650, height: 88, fontSize: 42, fontFamily: 'Impact', fontWeight: 800, color: '#FFFFFF', align: 'left', opacity: 1, rotation: 0, shadow: true, visible: true, zIndex: 21 },
                { id: 'member-avatar', type: 'avatar', content: '', x: 68, y: 66, width: 190, height: 190, shape: 'circle', opacity: 1, rotation: 0, visible: true, zIndex: 15 },
                { id: 'avatar-ring', type: 'shape', shape: 'circle', fill: '#FFFFFF', stroke: '#7C6CF5', strokeWidth: 5, x: 62, y: 60, width: 202, height: 202, radius: 0, opacity: 1, visible: true, zIndex: 10 }
            ],
            maxElements: 40,
            availableFonts: ['Arial', 'Arial Black', 'Impact', 'Georgia', 'Trebuchet MS', 'Verdana', 'Courier New'],
            upload: { maxBytes: 6291456, allowedMime: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], maxAssets: 50 }
        }
    },
    verifyDefaults: {
        enabled: false,
        channelId: null,
        roleId: null,
        message: 'Click the button below to verify.',
        title: 'Verification',
        buttonLabel: 'Verify',
        buttonStyle: 'Success',
        logChannelId: null,
        removeOnMemberLeave: false
    },
    jailDefaults: {
        roleId: null,
        restoreRoles: true,
        channelId: null,
        reasonRequired: false,
        allowJailRoleBypass: true
    },
    reactionRoleDefaults: {
        restoreOnRejoin: true,
        removeOnLeave: false,
        allowMultiple: true,
        maxPerMessage: 20
    },
    boosterRoleDefaults: {
        enabled: true,
        baseRoleId: null,
        limit: 20,
        color: purple,
        maxNameLength: 32,
        deleteOnBoostEnd: false,
        renameOnBoostEnd: false
    },
    imageOnlyDefaults: {
        enabled: true,
        deleteDelayMs: 0,
        allowEmbeds: true,
        allowLinks: false,
        allowStickers: true,
        allowTenorGiphy: false,
        warningEnabled: true,
        warningThreshold: 2,
        warningWindowSeconds: 600,
        warningMessage: 'Only image messages are allowed in {channel}. Further violations may result in a timeout.',
        notifyMode: 'dm',
        repeatWarnings: false,
        timeoutEnabled: false,
        timeoutThreshold: 5,
        timeoutSeconds: 300,
        customMessage: 'Only image attachments are allowed in this channel.'
    },
    honeypotDefaults: {
        enabled: false,
        channelIds: [],
        threshold: 1,
        windowSeconds: 300,
        action: 'log',
        timeoutSeconds: 3600,
        exemptStaff: true,
        notifyUser: true,
        noticeMessage: 'Do not send messages in this channel. It is monitored as a security honeypot. Your message was removed; repeated activity may result in a warning, timeout, kick, or ban.',
        punishedMessage: 'A security rule was triggered and a moderation action was applied. Contact server staff if you believe this was a mistake.',
        warningTitle: 'DO NOT SEND MESSAGES IN THIS CHANNEL',
        warningDescription: 'This channel is used to detect spam bots and malicious activity. Do not send messages here. Sending messages may result in a warning, timeout, kick, or ban.',
        logChannelId: null
    },
    counterDefaults: {
        updateIntervalMs: 60000,
        prefixes: {
            members: 'Members: ', humans: 'Humans: ', bots: 'Bots: ', boosts: 'Boosts: ', roles: 'Roles: ',
            channels: 'Channels: ', voice: 'Voice: ', text: 'Text: '
        },
        suffixes: { members: '', humans: '', bots: '', boosts: '', roles: '', channels: '', voice: '', text: '' }
    },
    snipeDefaults: { cachePerChannel: 25, protectedSeconds: 20, enabled: true },
    stickyDefaults: { repostOnNewMessage: true, title: 'Sticky Message', color: purple },
    voiceMasterDefaults: {
        enabled: false,
        categoryId: null,
        joinChannelId: null,
        generatedPrefix: '・',
        defaultLimit: 0,
        defaultRegion: 'auto',
        ownerCanLock: true,
        ownerCanHide: true
    },
    birthdayDefaults: {
        channelId: null,
        roleId: null,
        message: 'Happy birthday {user}!',
        timezone: 'UTC',
        announceTime: '09:00'
    },
    suggestionDefaults: {
        channelId: null,
        staffRoleIds: [],
        statuses: ['pending', 'approved', 'denied'],
        anonymous: false,
        allowStaffReply: true
    },
    prefixes: { enabled: true, default: '.', maxLength: 3, allowed: ['.', '!', '?'], mentionFallback: true },
    dmTemplates: {
        warn: 'A moderation warning was recorded for you in {server}.\n\nWarning ID: #{warningId}\nCase: #{caseId}\nActive warnings: {warningCount}\nReason: {reason}\nModerator: {moderator}\n\n{automaticAction}',
        kick: 'You were kicked from {server}.\n\nReason: {reason}\nModerator: {moderator}\nCase: #{caseId}',
        ban: 'You were permanently banned from {server}.\n\nDuration: {duration}\nReason: {reason}\nModerator: {moderator}\nCase: #{caseId}',
        tempban: 'You were temporarily banned from {server}.\n\nDuration: {duration}\nExpiry: {expiresAt}\nReason: {reason}\nModerator: {moderator}\nCase: #{caseId}',
        tempbanExpired: 'Your temporary ban in {server} has expired. You may rejoin the server. Original case: #{caseId}.',
        timeout: 'You were timed out in {server}.\n\nDuration: {duration}\nExpiry: {expiresAt}\nReason: {reason}\nModerator: {moderator}\nCase: #{caseId}',
        untimeout: 'Your Discord timeout in {server} was removed by {moderator}. Case: #{caseId}.',
        warningRemoved: 'Warning #{warningId} in {server} was removed from the active warning list by {moderator}. Historical records are retained. Reason: {reason}',
        pardon: 'Your active warnings in {server} were cleared by {moderator}. Warnings cleared: {warningCount}. Historical moderation records are retained. Reason: {reason}',
        clearwarnings: 'Your active warnings in {server} were cleared by {moderator}. Number of warnings cleared: {warningCount}. Historical moderation records are retained. Reason: {reason}',
        unban: 'Your ban from {server} was removed by a moderator. Case: #{caseId}.',
        jail: 'You were jailed in {server}.\n\nReason: {reason}\nModerator: {moderator}',
        unjail: 'You were released from jail in {server}.\nModerator: {moderator}. Case: #{caseId}.',
        verify: 'You are now verified in {server}.',
        ticketCreated: 'Your support ticket has been created in {server}.',
        applicationReceived: 'We received your application for {server}.',
        applicationAccepted: 'Your application for {server} was accepted.',
        applicationRejected: 'Your application for {server} was rejected.\n\nReason: {reason}'
    },
    messages: {
        noPermission: 'You do not have permission for that.',
        guildOnly: 'This command can only be used in a server.',
        adminOnly: 'Administrator permissions are required.',
        staffOnly: 'Staff permissions are required.',
        notFoundUser: 'I could not find that user.',
        invalidAmount: 'Enter a valid amount.',
        invalidDuration: 'Use a duration such as `10m`, `2h` or `7d`.',
        saved: 'The requested settings have been saved for this server. You can continue editing other options in the Dashboard.',
        cancelled: 'Cancelled.',
        setupSaved: 'Settings updated.',
        ticketCreated: 'Ticket created.',
        ticketClosed: 'Ticket closed.',
        ticketLimit: 'You already have too many open tickets.',
        verificationSuccess: 'You are verified.',
        verificationAlready: 'You are already verified.',
        commandDisabled: 'That command is disabled for this server.',
        genericError: 'Something went wrong.',
        notConfigured: 'This feature is not configured yet.',
        invalidChannel: 'That channel is invalid.',
        invalidRole: 'That role is invalid.',
        invalidHex: 'Use a valid hex color such as `#7C6CF5`.',
        notInTicket: 'This command can only be used inside a ticket.',
        userAdded: 'Added {user}.',
        userRemoved: 'Removed {user}.',
        noResults: 'Nothing found.'
    }
};
exports.config.links = {
    website: '',
    discord: '',
    support: '',
    privacy: '',
    terms: ''
};
exports.config.embeds = {
    timestamp: true,
    footerEnabled: false,
    defaultTitle: 'Auralis',
    supportColor: purple,
    moderationColor: red,
    successColor: green,
    warningColor: yellow,
    infoColor: blue,
    neutralColor: gray,
    useBrandLogoAsAuthor: false,
    authorName: 'Auralis',
    authorIconUrl: ''
};
exports.config.panels = {
    support: { enabled: true, title: 'Support Center', description: 'Choose a category below and Auralis will create a private ticket.', channelId: null },
    applications: { enabled: true, title: 'Applications', description: 'Choose an application below.', channelId: null },
    verify: { enabled: false, title: 'Verify', description: 'Click the button below to verify.', channelId: null },
    reactionRoles: { enabled: true, title: 'Roles', description: 'Choose the roles you want.', channelId: null },
    giveaways: { title: 'Giveaway', description: 'Enter below.', buttonLabel: 'Enter Giveaway' },
    polls: { title: 'Poll', description: 'Choose an option below.', showResultsAfterClose: true }
};
exports.config.messagesExtended = {
    ticket: {
        created: 'Your ticket has been created.',
        claimed: 'This ticket is now being handled by {staff}.',
        closed: 'This ticket will close shortly.',
        add: 'Added {user}.',
        remove: 'Removed {user}.',
        panelSent: 'Ticket panel sent.',
        alreadyClaimed: 'This ticket is already claimed.',
        claimMissing: 'You are not allowed to claim this ticket.'
    },
    application: {
        submitted: 'Your application has been submitted.',
        accepted: 'Your application was accepted.',
        rejected: 'Your application was rejected.',
        cooldown: 'You must wait {duration} before applying again.'
    },
    moderation: {
        warn: 'Warning issued — Case #{case}',
        ban: 'Banned — Case #{case}',
        tempban: 'Temporary ban applied — Case #{case}',
        kick: 'Kicked — Case #{case}',
        timeout: 'Timed out — Case #{case}',
        untimeout: 'Timeout removed.',
        jail: 'Jailed — Case #{case}',
        unjail: 'Released from jail — Case #{case}',
        threshold: 'Punishment threshold reached — {action}'
    },
    automod: {
        delete: 'That message was removed by AutoMod.',
        slowmode: 'Please slow down.',
        attachmentBlocked: 'This file type is not allowed in this channel.',
        mentionBlocked: 'Too many mentions.',
        inviteBlocked: 'Invites are not allowed here.',
        linkBlocked: 'Links are not allowed here.'
    },
    verify: { success: 'Verification complete.', already: 'You are already verified.', failed: 'Verification could not be completed.' },
    levels: { up: '{user} reached Level {level}.', enabled: 'Levels enabled.', disabled: 'Levels disabled.' },
    security: { raid: 'A join spike triggered Anti-Raid.', antinuke: 'A protected administrative action was detected.' },
    common: { saved: 'The requested settings have been saved for this server.', enabled: 'This feature is now enabled.', disabled: 'This feature is now disabled.', notFound: 'No matching item was found.', invalid: 'The provided value is invalid. Please check the required format and try again.' }
};
exports.config.customEmbedPresets = [];
exports.config.commandGroups = {
    support: ['setup', 'help', 'panel', 'tickets', 'applications', 'close', 'add', 'remove', 'picperms', 'stats', 'leaderboard', 'staffactivity', 'commands'],
    moderation: ['warn', 'warnings', 'unwarn', 'clearwarnings', 'punishmentstats', 'history', 'caselog', 'reason', 'ban', 'unban', 'banlist', 'tempban', 'kick', 'kicklist', 'mute', 'tempmute', 'unmute', 'pardon', 'punish', 'unpunish', 'untimeoutall', 'purge', 'cleanup', 'lockdown', 'unlock', 'lockdownall', 'unlockdownall', 'strip', 'jail', 'unjail', 'jailed', 'setjail', 'setjailauto', 'hide', 'unhide', 'slowmode', 'nsfw', 'audit', 'rollback', 'pin', 'unpin'],
    security: ['antinuke', 'verify', 'honeypot', 'imgonly'],
    community: ['poll', 'giveaways', 'suggest', 'birthday', 'timezone', 'time', 'level', 'levelup', 'autorole', 'reactionrole', 'buttonrole', 'boosterrole', 'tag', 'customcmd', 'sticky', 'counter'],
    utility: ['serverinfo', 'userinfo', 'channelinfo', 'roleinfo', 'avatar', 'banner', 'membercount', 'roles', 'emojis', 'stickers', 'inrole', 'newusers', 'boomer', 'invite', 'inviteinfo', 'invites', 'translate', 'crypto', 'color', 'randomhex', 'remind', 'afk', 'ping', 'botinfo', 'prefix', 'embed', 'announce', 'template', 'webhook'],
    prefix: ['snipe', 'editsnipe', 'reactionsnipe', 'clearsnipe', 'snipeprotect', 'say', '8ball', 'choose', 'coinflip', 'rps', 'dice', 'howgay', 'pp', 'iq', 'uwuify', 'quote', 'urbandictionary', 'bible', 'ship', 'rate', 'roast', 'rizz', 'howautistic', 'hot', 'simp', 'braincells', 'cursed', 'luck', 'fact', 'joke', 'reverse', 'mock', 'math', 'lyrics', 'qr', 'balance', 'bank', 'deposit', 'withdraw', 'bankup', 'daily', 'work', 'give', 'cooldowns', 'gamble', 'rob', 'baltop', 'badges', 'github', 'roblox', 'rotate', 'compress', 'invert']
};
exports.config.publicDirectoryDefaults = {
    enabled: true,
    order: 0,
    requireDescription: false,
    descriptionMode: 'placeholder',
    descriptionFallback: 'No public description provided.',
    autoInvite: true,
    inviteChannelId: '',
    invite: ''
};
exports.config.modules = {
    tickets: true,
    applications: true,
    moderation: true,
    automod: true,
    antiraid: true,
    antinuke: true,
    verify: false,
    jail: true,
    welcome: false,
    levels: false,
    giveaways: true,
    polls: true,
    reactionroles: true,
    buttonroles: true,
    boosterroles: true,
    voicemaster: false,
    suggestions: true,
    birthdays: true,
    timezones: true,
    counters: true,
    imageonly: true,
    honeypot: true,
    sticky: true,
    tags: true,
    customcmd: true,
    prefix: true,
    embeds: true,
    webhooks: true,
    snipe: true,
    economy: true,
    fun: true,
    utility: true,
    autoroles: true,
    logs: true,
    automations: true,
    responses: true,
    announcements: true,
    staffactivity: true
};
exports.config.commandPermissions = {};
exports.config.fileProtection = {
    defaultBlockedExtensions: exports.config.automodDefaults.fileBlock.blockedExtensions,
    allowImages: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'],
    allowVideo: ['mp4', 'webm', 'mov'],
    allowAudio: ['mp3', 'wav', 'ogg', 'm4a'],
    channelOverrides: {}
};
exports.config.dashboardAccess = {
    owners: {
        '1344403298949533750': {
            name: 'ObsidianDev',
            username: 'crypticcraze1234',
            permissions: ['*']
        }
    },
    staffPermissions: [
        'view_all_guilds',
        'manage_guilds',
        'leave_guilds',
        'blacklist_guilds',
        'manage_bot_status',
        'manage_staff',
        'view_analytics'
    ]
};
exports.config.dashboardSecurity = {
    cookieName: 'auralis_session',
    sameSite: 'Lax',
    secureInProduction: true,
    maxBodyBytes: '12mb',
    allowedPatchSections: Object.keys(exports.config).filter(key => !['dashboardAccess', 'dashboardSecurity'].includes(key)),
    dashboardRoles: [],
    allowRawConfigExport: true,
    allowRawConfigImport: true
};
exports.config.performance = {
    commandRegistrationOnReady: true,
    counterRefreshMs: 60000,
    reminderPollMs: 10000,
    giveawayPollMs: 5000,
    tempbanPollMs: 15000,
    birthdayPollMs: 60000,
    cleanupPollMs: 300000,
    maxParallelGuildTasks: 4,
    maxAuditFetch: 100,
    cacheDiscordUsers: true,
    automodWindowMax: 20,
    writeDebounceMs: 250
};
exports.config.logging = {
    redactFields: ['token', 'secret', 'apiKey', 'password', 'authorization', 'clientSecret'],
    consolePrefix: '[Auralis]',
    includeCaseIds: true,
    includeModerator: true,
    includeTarget: true,
    includeReason: true,
    includeChannel: true,
    includeMessageLinks: true
};
exports.config.developer = {
    version: '2.2.9',
    author: 'Auralis',
    environment: process.env.NODE_ENV ?? 'development',
    supportCommands: true,
    verboseErrors: false
};
function cloneDefaults() {
    return structuredClone(exports.config);
}

});
__factories.set("src/dashboard-server.js", function(exports, require, module, __filename, __dirname) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const dotenv_1 = __importDefault(require("dotenv"));
const discord_js_1 = require("discord.js");
const config_js_1 = require("./config.js");
const db_js_1 = require("./db.js");
const ui_js_1 = require("./lib/ui.js");
const core_js_1 = require("./lib/core.js");
const public_api_js_1 = require("./public-api.js");
const bot_health_js_1 = require("./lib/bot-health.js");
const invites_js_1 = require("./systems/invites.js");
const commands_js_1 = require("./commands.js");
const applications_js_1 = require("./systems/applications.js");
const community_js_1 = require("./systems/community.js");
const polls_js_1 = require("./systems/polls.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.disable('x-powered-by');
app.use(express_1.default.json({ limit: config_js_1.config.dashboardSecurity.maxBodyBytes }));
function normalizedOrigin(value) {
    const raw = String(value || '').trim();
    if (!raw)
        return '';
    try {
        return new URL(raw).origin;
    }
    catch {
        return '';
    }
}
const allowedOrigins = new Set([
    process.env.DASHBOARD_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',')
].map(normalizedOrigin).filter(Boolean));
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
        res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS')
        return res.sendStatus(204);
    next();
});
const botRoot = node_path_1.default.resolve(process.env.AURALIS_ROOT || process.cwd());
const bundledDashboard = node_path_1.default.resolve(node_path_1.default.join(botRoot, 'dashboard-ui'));
const requestedWebsite = process.env.AURALIS_WEBSITE_DIR ? node_path_1.default.resolve(process.env.AURALIS_WEBSITE_DIR) : null;
const staticRoot = requestedWebsite || bundledDashboard;
const assetRoot = node_path_1.default.resolve(process.env.AURALIS_ASSET_DIR || node_path_1.default.join(botRoot, 'Data'));
node_fs_1.default.mkdirSync(assetRoot, { recursive: true });
if (!node_fs_1.default.existsSync(staticRoot))
    throw new Error(`Auralis dashboard files were not found. Looked for ${staticRoot}. Re-extract the complete bot archive.`);
const oauthState = new Map();
const oauthExchangeTickets = new Map();
const DEFAULT_PUBLIC_SITE_URL = 'https://auralisdev.github.io/Auralis/';
function cookieSecret() {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
        return process.env.NODE_ENV === 'production' ? null : 'auralis-development-only-secret-change-me-please';
    }
    return secret;
}
function sign(value) {
    const secret = cookieSecret();
    if (!secret)
        return '';
    return node_crypto_1.default.createHmac('sha256', secret).update(value).digest('base64url');
}
function setCookie(res, name, value, maxAge) {
    const cross = process.env.DASHBOARD_CROSS_ORIGIN === 'true';
    const secure = cross || process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=${cross ? 'None' : 'Lax'}; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}
function clearCookie(res, name) {
    const cross = process.env.DASHBOARD_CROSS_ORIGIN === 'true';
    const secure = cross || process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `${name}=; HttpOnly; SameSite=${cross ? 'None' : 'Lax'}; Path=/; Max-Age=0${secure ? '; Secure' : ''}`);
}
function configuredPublicSiteUrl() {
    const raw = String(process.env.PUBLIC_SITE_URL || DEFAULT_PUBLIC_SITE_URL).trim();
    try {
        const url = new URL(raw);
        if (url.protocol !== 'https:')
            return new URL(DEFAULT_PUBLIC_SITE_URL);
        url.search = '';
        url.hash = '';
        if (!url.pathname.endsWith('/'))
            url.pathname += '/';
        return url;
    }
    catch {
        return new URL(DEFAULT_PUBLIC_SITE_URL);
    }
}
function safePublicReturnTo(raw) {
    if (!raw)
        return null;
    try {
        const candidate = new URL(String(raw));
        const configured = configuredPublicSiteUrl();
        if (candidate.origin !== configured.origin)
            return null;
        const normalPath = candidate.pathname.endsWith('/') ? candidate.pathname : `${candidate.pathname}/`;
        if (normalPath !== configured.pathname)
            return null;
        candidate.pathname = configured.pathname;
        return candidate;
    }
    catch {
        return null;
    }
}
function safeSessionUser(payload) {
    if (!payload || typeof payload !== 'object')
        return null;
    const { oauthAccessToken, oauthExpiresAt, oauthRefreshToken, ...safeUser } = payload;
    return safeUser;
}
function session(req) {
    const cookieName = config_js_1.config.dashboardSecurity.cookieName;
    const raw = req.headers.cookie?.match(new RegExp(`(?:^|; )${cookieName}=([^;]+)`))?.[1];
    if (!raw)
        return null;
    const token = decodeURIComponent(raw);
    const dot = token.lastIndexOf('.');
    if (dot <= 0)
        return null;
    const id = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    if (signature !== sign(id))
        return null;
    const row = db_js_1.db.prepare('SELECT * FROM sessions WHERE token=? AND expires_at>?').get(id, Date.now());
    if (!row)
        return null;
    try {
        return { id, payload: JSON.parse(row.user_json) };
    }
    catch {
        return null;
    }
}
async function auth(req, res, next) {
    const current = session(req);
    if (!current)
        return res.status(401).json({ error: 'Not authenticated.' });
    req.sessionId = current.id;
    req.user = current.payload;
    if (Date.now() - Number(req.user.guildPermissionsCheckedAt || 0) > 60_000) {
        try {
            await refreshSessionGuilds(req);
        }
        catch (error) {
            console.warn(`${config_js_1.config.logging.consolePrefix} Could not refresh Discord guild permissions: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    next();
}
async function refreshSessionGuilds(req) {
    if (!req.user?.id || !req.sessionId)
        return false;
    let accessToken = req.user.oauthAccessToken;
    let expiresAt = Number(req.user.oauthExpiresAt || 0);
    if (!accessToken || expiresAt <= Date.now() + 30_000) {
        const refreshToken = req.user.oauthRefreshToken;
        if (!refreshToken || !process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
            req.user.guilds = [];
            req.user.guildPermissionsCheckedAt = Date.now();
            db_js_1.db.prepare('UPDATE sessions SET user_json=? WHERE token=?').run(JSON.stringify(req.user), req.sessionId);
            return false;
        }
        const form = new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        });
        const refreshResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form
        }).catch(() => null);
        const refreshed = await refreshResponse?.json().catch(() => ({}));
        if (!refreshResponse?.ok || !refreshed?.access_token) {
            req.user.guilds = [];
            req.user.oauthAccessToken = null;
            req.user.oauthRefreshToken = null;
            req.user.oauthExpiresAt = 0;
            req.user.guildPermissionsCheckedAt = Date.now();
            db_js_1.db.prepare('UPDATE sessions SET user_json=? WHERE token=?').run(JSON.stringify(req.user), req.sessionId);
            return false;
        }
        accessToken = refreshed.access_token;
        expiresAt = Date.now() + Number(refreshed.expires_in ?? 604800) * 1000;
        req.user.oauthAccessToken = accessToken;
        req.user.oauthRefreshToken = refreshed.refresh_token || refreshToken;
        req.user.oauthExpiresAt = expiresAt;
    }
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` }
    }).catch(() => null);
    if (!response?.ok) {
        if (response && [400, 401, 403].includes(response.status))
            req.user.guilds = [];
        req.user.guildPermissionsCheckedAt = Date.now();
        db_js_1.db.prepare('UPDATE sessions SET user_json=? WHERE token=?').run(JSON.stringify(req.user), req.sessionId);
        return false;
    }
    const guilds = await response.json().catch(() => null);
    if (!Array.isArray(guilds))
        return false;
    req.user.guilds = guilds.filter(isManageableGuild).map(enrichGuildAccess).slice(0, config_js_1.config.dashboard.maxGuildsPerUser);
    req.user.guildPermissionsCheckedAt = Date.now();
    db_js_1.db.prepare('UPDATE sessions SET user_json=? WHERE token=?').run(JSON.stringify(req.user), req.sessionId);
    return true;
}
function enrichGuildAccess(guild) {
    const permissions = BigInt(guild?.permissions ?? '0');
    const administrator = guild?.owner === true || (permissions & discord_js_1.PermissionsBitField.Flags.Administrator) !== 0n;
    return { ...guild, administrator, canManageGuild: isManageableGuild(guild) };
}
function isManageableGuild(guild) {
    if (!guild)
        return false;
    if (guild.owner === true)
        return true;
    const permissions = BigInt(guild.permissions ?? '0');
    if ((permissions & discord_js_1.PermissionsBitField.Flags.Administrator) !== 0n)
        return true;
    if (config_js_1.config.dashboard.requireAdministratorForSetup)
        return false;
    return config_js_1.config.dashboard.allowManageGuildPermission
        && (permissions & discord_js_1.PermissionsBitField.Flags.ManageGuild) !== 0n;
}
function globalAccess(userId) {
    const owner = config_js_1.config.dashboardAccess.owners?.[String(userId)];
    if (owner)
        return { level: 'owner', userId: String(userId), name: owner.name, username: owner.username, permissions: ['*'] };
    const staff = (0, db_js_1.getDashboardStaff)(userId);
    if (staff)
        return { level: 'staff', userId: String(userId), name: staff.label || 'Auralis Staff', permissions: staff.permissions ?? [] };
    return { level: 'none', userId: String(userId), name: null, permissions: [] };
}
function hasGlobalPermission(user, permission) {
    const access = globalAccess(user?.id);
    return access.level === 'owner' || access.permissions.includes('*') || access.permissions.includes(permission);
}
function canManageGuild(user, guildId) {
    return isManageableGuild(user.guilds?.find(g => g.id === guildId)) || hasGlobalPermission(user, 'manage_guilds');
}
function canViewAllGuilds(user) {
    return hasGlobalPermission(user, 'view_all_guilds');
}
async function botApi(pathname, options = {}) {
    const { throwOnError = false, ...requestOptions } = options;
    if (!process.env.DISCORD_TOKEN) {
        if (throwOnError)
            throw new Error('DISCORD_TOKEN is missing. Add the bot token to the server .env file.');
        return null;
    }
    try {
        const response = await fetch(`https://discord.com/api/v10${pathname}`, {
            ...requestOptions,
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, Accept: 'application/json', ...(requestOptions.headers ?? {}) }
        });
        const text = await response.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            }
            catch {
                if (throwOnError)
                    throw new Error(`Discord API returned a non-JSON response (HTTP ${response.status}, ${response.headers.get('content-type') || 'unknown content type'}).`);
            }
        }
        if (!response.ok) {
            const detail = data?.message || data?.error || `HTTP ${response.status}`;
            if (throwOnError)
                throw new Error(`Discord API request failed: ${detail}${data?.code ? ` (code ${data.code})` : ''}.`);
            return null;
        }
        return data;
    }
    catch (error) {
        if (throwOnError)
            throw error;
        return null;
    }
}
function restMessagePayload(payload = {}) {
    const out = { ...payload };
    if (Array.isArray(out.embeds))
        out.embeds = out.embeds.map(embed => embed?.toJSON?.() ?? embed);
    if (Array.isArray(out.components))
        out.components = out.components.map(row => row?.toJSON?.() ?? row);
    if (out.allowedMentions) {
        out.allowed_mentions = out.allowedMentions;
        delete out.allowedMentions;
    }
    return out;
}
async function botGuilds() {
    return (0, db_js_1.listBotGuildIndex)().filter(guild => !(0, db_js_1.isGuildBlacklisted)(guild.id));
}
async function botGuildIds() {
    return new Set((await botGuilds()).map(g => g.id));
}
async function discordBotGuild(id) {
    return botApi(`/guilds/${id}?with_counts=true`);
}
function jsonError(res, status, error) { return res.status(status).json({ error }); }
(0, public_api_js_1.registerPublicRoutes)(app).then(() => {
    app.get('/health', (_, res) => res.json({ ok: true, name: config_js_1.config.brand.name, version: config_js_1.config.developer.version }));
    function oauthRedirectUri() {
        const configured = String(process.env.DISCORD_REDIRECT_URI ?? '').trim();
        const port = Number(process.env.PORT || config_js_1.config.dashboard.port);
        return configured || `http://localhost:${port}/auth/discord/callback`;
    }
    function dashboardReturnUrl() {
        const configured = String(process.env.DASHBOARD_URL ?? '').trim();
        return configured || '/dashboard/';
    }
    app.get('/api/oauth/config', (req, res) => res.json({ redirectUri: oauthRedirectUri(), loginPath: '/auth/discord', callbackPath: '/auth/discord/callback' }));
    app.get('/auth/discord/setup', (req, res) => {
        const uri = oauthRedirectUri();
        res.type('html').send(`<!doctype html><html><head><meta charset=\"utf-8\"><title>Auralis OAuth setup</title><style>body{font-family:system-ui;background:#08080d;color:#f5f4f8;display:grid;place-items:center;min-height:100vh;margin:0}.card{width:min(680px,calc(100% - 40px));padding:28px;border:1px solid #272532;border-radius:20px;background:#111018}code{display:block;padding:14px;border-radius:10px;background:#09090d;word-break:break-all;color:#b9bfff;margin:12px 0}.muted{color:#9c98aa;line-height:1.6}a{color:#a9a2ff}</style></head><body><div class=\"card\"><h1>Auralis Discord Login</h1><p class=\"muted\">Add this exact redirect URI to your Discord Developer Portal under OAuth2 → Redirects, then try Login with Discord again.</p><code>${uri.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code><p class=\"muted\">Discord requires the authorization redirect URI to be one that is registered for the application; it must match exactly.</p><p><a href=\"https://discord.com/developers/applications/${encodeURIComponent(String(process.env.DISCORD_CLIENT_ID || ''))}/oauth2\" target=\"_blank\" rel=\"noreferrer\">Open Discord Developer Portal</a></p><p><a href=\"/auth/discord\">Retry Login</a></p></div></body></html>`);
    });
    app.get('/auth/discord', (req, res) => {
        if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET)
            return res.status(500).send('Discord OAuth is not configured.');
        const redirectUri = oauthRedirectUri();
        let parsed;
        try {
            parsed = new URL(redirectUri);
        }
        catch {
            return res.status(500).send('DISCORD_REDIRECT_URI is not a valid URL.');
        }
        if (!['http:', 'https:'].includes(parsed.protocol))
            return res.status(500).send('DISCORD_REDIRECT_URI must use http or https.');
        const state = node_crypto_1.default.randomBytes(24).toString('base64url');
        const returnTo = safePublicReturnTo(req.query.return_to);
        oauthState.set(state, { expiresAt: Date.now() + config_js_1.config.dashboard.oauthStateMinutes * 60_000, returnTo: returnTo?.href || null });
        const params = new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: config_js_1.config.dashboard.scopes.join(' '),
            state
        });
        res.redirect(`https://discord.com/oauth2/authorize?${params}`);
    });
    app.get('/auth/discord/callback', async (req, res) => {
        try {
            const state = String(req.query.state ?? '');
            const stateEntry = oauthState.get(state);
            oauthState.delete(state);
            if (!state || !stateEntry || Number(stateEntry.expiresAt || 0) < Date.now())
                return res.status(400).send('OAuth state expired. Start again from Login with Discord.');
            if (req.query.error)
                throw new Error(`Discord authorization was cancelled or denied: ${String(req.query.error_description || req.query.error).slice(0, 300)}`);
            const code = String(req.query.code ?? '');
            if (!code)
                throw new Error('Discord did not return an authorization code. Start again from the Auralis Login with Discord button.');
            const body = new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: oauthRedirectUri()
            });
            const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
            const token = await tokenResponse.json().catch(() => ({}));
            if (!tokenResponse.ok || !token.access_token)
                throw new Error(`Discord OAuth token exchange failed (HTTP ${tokenResponse.status}). Check the Client Secret and that DISCORD_REDIRECT_URI exactly matches the registered redirect URI.`);
            const headers = { Authorization: `Bearer ${token.access_token}` };
            const [userResponse, guildResponse] = await Promise.all([
                fetch('https://discord.com/api/v10/users/@me', { headers }),
                fetch('https://discord.com/api/v10/users/@me/guilds', { headers })
            ]);
            const user = await userResponse.json().catch(() => ({}));
            const guilds = await guildResponse.json().catch(() => ({}));
            if (!userResponse.ok || !user?.id)
                throw new Error(`Discord could not return the signed-in profile (HTTP ${userResponse.status}). Reauthorize and try again.`);
            if (!guildResponse.ok || !Array.isArray(guilds))
                throw new Error(`Discord could not return your server list (HTTP ${guildResponse.status}). In the OAuth2 login scopes, select identify and guilds (not connections), then log in again.`);
            const installedGuildIds = new Set((await botGuilds()).map(guild => String(guild.id)));
            const manageableGuilds = guilds.filter(isManageableGuild).map(guild => ({
                ...enrichGuildAccess(guild),
                botInstalled: installedGuildIds.has(String(guild.id))
            }));
            const payload = { ...user, guilds: manageableGuilds.slice(0, config_js_1.config.dashboard.maxGuildsPerUser), oauthAccessToken: token.access_token, oauthExpiresAt: Date.now() + Number(token.expires_in ?? 604800) * 1000, oauthRefreshToken: token.refresh_token ?? null, guildPermissionsCheckedAt: Date.now() };
            const sid = node_crypto_1.default.randomBytes(32).toString('base64url');
            db_js_1.db.prepare('INSERT INTO sessions(token,user_json,expires_at) VALUES(?,?,?)').run(sid, JSON.stringify(payload), Date.now() + config_js_1.config.dashboard.sessionDays * 86_400_000);
            setCookie(res, config_js_1.config.dashboardSecurity.cookieName, `${sid}.${sign(sid)}`, config_js_1.config.dashboard.sessionDays * 86400);
            if (stateEntry.returnTo) {
                const ticket = node_crypto_1.default.randomBytes(32).toString('base64url');
                const publicUser = safeSessionUser(payload);
                const exchangePayload = {
                    user: publicUser,
                    dashboardAccess: globalAccess(user.id),
                    botReady: (0, bot_health_js_1.getBotHealthSnapshot)().online,
                    botStatus: (0, bot_health_js_1.getBotHealthSnapshot)().status,
                    brand: { name: config_js_1.config.brand.name, logoUrl: config_js_1.config.brand.logoUrl, description: config_js_1.config.brand.description }
                };
                const now = Date.now();
                for (const [key, value] of oauthExchangeTickets)
                    if (value.expiresAt <= now)
                        oauthExchangeTickets.delete(key);
                oauthExchangeTickets.set(ticket, { expiresAt: now + 90_000, payload: exchangePayload });
                const returnUrl = new URL(stateEntry.returnTo);
                returnUrl.searchParams.set('auth_ticket', ticket);
                returnUrl.hash = 'manage-servers';
                return res.redirect(returnUrl.href);
            }
            res.redirect(dashboardReturnUrl());
        }
        catch (error) {
            res.status(500).type('text/plain').send(`OAuth error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    app.post('/auth/exchange-ticket', (req, res) => {
        const ticket = String(req.body?.ticket || '');
        if (!ticket || ticket.length > 160)
            return jsonError(res, 400, 'Login ticket is missing or invalid. Please sign in again.');
        const entry = oauthExchangeTickets.get(ticket);
        oauthExchangeTickets.delete(ticket);
        if (!entry || entry.expiresAt <= Date.now())
            return jsonError(res, 400, 'Login ticket expired. Please click Login with Discord again.');
        return res.json(entry.payload);
    });
    function clearCurrentSession(req, res) {
        const cookieName = config_js_1.config.dashboardSecurity.cookieName;
        const raw = req.headers.cookie?.match(new RegExp(`(?:^|; )${cookieName}=([^;]+)`))?.[1];
        const token = raw ? decodeURIComponent(raw).slice(0, decodeURIComponent(raw).lastIndexOf('.')) : null;
        if (token)
            db_js_1.db.prepare('DELETE FROM sessions WHERE token=?').run(token);
        clearCookie(res, cookieName);
    }
    app.get('/auth/logout', (req, res) => {
        clearCurrentSession(req, res);
        const returnTo = safePublicReturnTo(req.query.return_to);
        if (returnTo)
            return res.redirect(returnTo.href);
        return res.redirect(dashboardReturnUrl());
    });
    app.post('/auth/logout', (req, res) => {
        clearCurrentSession(req, res);
        res.json({ ok: true });
    });
    app.get('/api/me', auth, (req, res) => {
        const { oauthAccessToken, oauthExpiresAt, ...safeUser } = req.user;
        const botHealth = (0, bot_health_js_1.getBotHealthSnapshot)();
        res.set('Cache-Control', 'no-store');
        return res.json({
            user: safeUser,
            dashboardAccess: globalAccess(req.user.id),
            botReady: botHealth.online,
            botStatus: botHealth.status,
            botHealth,
            invite: config_js_1.config.discord.installUrl || (0, ui_js_1.inviteUrl)(process.env.DISCORD_CLIENT_ID ?? '', discord_js_1.PermissionsBitField.resolve(config_js_1.config.discord.requiredBotPermissions)),
            brand: { name: config_js_1.config.brand.name, logoUrl: config_js_1.config.brand.logoUrl, description: config_js_1.config.brand.description }
        });
    });
    app.get('/api/guilds', auth, async (req, res) => {
        const installed = await botGuilds();
        const installedById = new Map(installed.map(g => [g.id, g]));
        let guilds;
        if (canViewAllGuilds(req.user)) {
            guilds = installed.map(g => ({ ...g, administrator: false, botInstalled: true }));
        }
        else {
            guilds = (req.user.guilds ?? []).filter(isManageableGuild).map(g => ({ ...enrichGuildAccess(g), botInstalled: installedById.has(g.id) }));
        }
        guilds.sort((a, b) => Number(b.botInstalled) - Number(a.botInstalled) || String(a.name).localeCompare(String(b.name)));
        res.json({ guilds, dashboardAccess: globalAccess(req.user.id) });
    });
    app.get('/api/guilds/:id', auth, async (req, res) => {
        const id = req.params.id;
        if (!canManageGuild(req.user, id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const guild = await discordBotGuild(id);
        const rows = db_js_1.db.prepare('SELECT type, COUNT(*) count FROM cases WHERE guild_id=? GROUP BY type ORDER BY count DESC').all(id);
        const openTickets = db_js_1.db.prepare("SELECT COUNT(*) count FROM tickets WHERE guild_id=? AND status='open'").get(id)?.count ?? 0;
        const totalTickets = db_js_1.db.prepare('SELECT COUNT(*) count FROM tickets WHERE guild_id=?').get(id)?.count ?? 0;
        const closedTickets = db_js_1.db.prepare("SELECT COUNT(*) count FROM tickets WHERE guild_id=? AND status<>'open'").get(id)?.count ?? 0;
        const pendingApplications = db_js_1.db.prepare("SELECT COUNT(*) count FROM applications WHERE guild_id=? AND status IN ('pending','reviewing')").get(id)?.count ?? 0;
        const reviewingApplications = db_js_1.db.prepare("SELECT COUNT(*) count FROM applications WHERE guild_id=? AND status='reviewing'").get(id)?.count ?? 0;
        const totalApplications = db_js_1.db.prepare('SELECT COUNT(*) count FROM applications WHERE guild_id=?').get(id)?.count ?? 0;
        const activeApplicationDrafts = db_js_1.db.prepare('SELECT COUNT(*) count FROM application_drafts WHERE guild_id=? AND expires_at>?').get(id, Date.now())?.count ?? 0;
        db_js_1.db.prepare('DELETE FROM application_drafts WHERE expires_at<=?').run(Date.now());
        const caseCount = db_js_1.db.prepare('SELECT COUNT(*) count FROM cases WHERE guild_id=?').get(id)?.count ?? 0;
        const activeCases = db_js_1.db.prepare('SELECT COUNT(*) count FROM cases WHERE guild_id=? AND active=1').get(id)?.count ?? 0;
        const activeWarnings = db_js_1.db.prepare('SELECT COUNT(*) count FROM warnings WHERE guild_id=? AND active=1').get(id)?.count ?? 0;
        const configData = (0, db_js_1.getGuildConfig)(id);
        res.json({
            guild: guild ? { id: guild.id, name: guild.name, icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256` : null, approximateMemberCount: guild.approximate_member_count ?? guild.member_count ?? null } : null,
            config: configData,
            stats: { openTickets, closedTickets, totalTickets, pendingApplications, reviewingApplications, totalApplications, activeApplicationDrafts, caseCount, activeCases, activeWarnings, cases: rows }
        });
    });
    app.get('/api/guilds/:id/summary', auth, async (req, res) => {
        const id = String(req.params.id);
        if (!canManageGuild(req.user, id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const guild = (0, db_js_1.listBotGuildIndex)().find(entry => String(entry.id) === id) || null;
        const cfg = (0, db_js_1.getGuildConfig)(id);
        const count = (sql, ...extraParams) => Number(db_js_1.db.prepare(sql).get(id, ...extraParams)?.count ?? 0);
        const stats = {
            openTickets: count("SELECT COUNT(*) AS count FROM tickets WHERE guild_id=? AND status='open'"),
            closedTickets: count("SELECT COUNT(*) AS count FROM tickets WHERE guild_id=? AND status<>'open'"),
            totalTickets: count('SELECT COUNT(*) AS count FROM tickets WHERE guild_id=?'),
            pendingApplications: count("SELECT COUNT(*) AS count FROM applications WHERE guild_id=? AND status IN ('pending','reviewing')"),
            reviewingApplications: count("SELECT COUNT(*) AS count FROM applications WHERE guild_id=? AND status='reviewing'"),
            totalApplications: count('SELECT COUNT(*) AS count FROM applications WHERE guild_id=?'),
            activeCases: count('SELECT COUNT(*) AS count FROM cases WHERE guild_id=? AND active=1'),
            caseCount: count('SELECT COUNT(*) AS count FROM cases WHERE guild_id=?'),
            activeWarnings: count('SELECT COUNT(*) AS count FROM warnings WHERE guild_id=? AND active=1'),
            activeApplicationDrafts: count('SELECT COUNT(*) AS count FROM application_drafts WHERE guild_id=? AND expires_at>?', Date.now())
        };
        const enabledModules = Object.values(cfg.modules || {}).filter(Boolean).length;
        res.set('Cache-Control', 'no-store');
        res.json({
            guild: guild ? { id: guild.id, name: guild.name, icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256` : null, approximateMemberCount: guild.member_count ?? guild.approximate_member_count ?? null } : null,
            stats: { ...stats, enabledModules },
            refreshedAt: Date.now()
        });
    });
    app.get('/api/guilds/:id/staff-overview', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const allowed = new Set(['today', '7d', '14d', 'all']);
        const range = allowed.has(String(req.query.range || '7d')) ? String(req.query.range || '7d') : '7d';
        const now = Date.now();
        const since = range === 'all' ? 0 : range === 'today' ? now - 86_400_000 : now - (range === '14d' ? 14 : 7) * 86_400_000;
        const events = db_js_1.db.prepare('SELECT user_id,event_type,COUNT(*) AS count,MAX(created_at) AS last_active_at FROM staff_activity_events WHERE guild_id=? AND created_at>=? GROUP BY user_id,event_type').all(guildId, since);
        const caseRows = db_js_1.db.prepare("SELECT moderator_id AS user_id,COUNT(*) AS count FROM cases WHERE guild_id=? AND created_at>=? AND type NOT IN ('UNTIMEOUT','UNBAN','UNJAIL') GROUP BY moderator_id").all(guildId, since);
        const totals = new Map();
        const init = id => { if (!totals.has(String(id)))
            totals.set(String(id), { userId: String(id), messages: 0, commands: 0, ticketCloses: 0, moderationCases: 0, actions: 0, lastActiveAt: 0 }); return totals.get(String(id)); };
        if (range === 'all') {
            for (const row of db_js_1.db.prepare('SELECT user_id,message_count,command_count,ticket_closes,moderation_actions,last_active_at FROM staff_activity WHERE guild_id=?').all(guildId)) {
                const item = init(row.user_id);
                item.messages = Number(row.message_count || 0);
                item.commands = Number(row.command_count || 0);
                item.ticketCloses = Number(row.ticket_closes || 0);
                item.actions = item.messages + item.commands + item.ticketCloses + Number(row.moderation_actions || 0);
                item.lastActiveAt = Number(row.last_active_at || 0);
            }
            for (const row of caseRows)
                init(row.user_id).moderationCases = Number(row.count || 0);
        }
        else {
            for (const row of events) {
                const item = init(row.user_id);
                const amount = Number(row.count || 0);
                if (row.event_type === 'message')
                    item.messages += amount;
                if (row.event_type === 'command')
                    item.commands += amount;
                if (row.event_type === 'ticket_close')
                    item.ticketCloses += amount;
                item.lastActiveAt = Math.max(item.lastActiveAt, Number(row.last_active_at || 0));
            }
            for (const row of caseRows)
                init(row.user_id).moderationCases = Number(row.count || 0);
            for (const item of totals.values())
                item.actions = item.messages + item.commands + item.ticketCloses + item.moderationCases;
        }
        const rows = [...totals.values()].sort((a, b) => b.actions - a.actions || b.lastActiveAt - a.lastActiveAt).slice(0, 100);
        const sum = rows.reduce((acc, row) => ({ messages: acc.messages + row.messages, commands: acc.commands + row.commands, ticketCloses: acc.ticketCloses + row.ticketCloses, moderationCases: acc.moderationCases + row.moderationCases, actions: acc.actions + row.actions }), { messages: 0, commands: 0, ticketCloses: 0, moderationCases: 0, actions: 0 });
        res.set('Cache-Control', 'no-store');
        res.json({ range, since, refreshedAt: now, totals: sum, staff: rows, note: range === 'all' ? 'All-time aggregates include historical activity from before detailed event history was enabled.' : 'Dated message/command/ticket activity is collected from this release onward; moderation cases use their recorded timestamps.' });
    });
    app.get('/api/guilds/:id/bot-profile', auth, async (req, res) => {
        const id = String(req.params.id);
        if (!canManageGuild(req.user, id))
            return jsonError(res, 403, 'You cannot manage this server.');
        try {
            const botUser = await botApi('/users/@me', { throwOnError: true });
            const member = await botApi(`/guilds/${id}/members/${botUser.id}`, { throwOnError: true });
            res.json({ ok: true, botId: botUser.id, username: botUser.username, nickname: member?.nick || '' });
        }
        catch (error) {
            jsonError(res, 502, `Could not read Auralis nickname: ${error.message}`);
        }
    });
    app.patch('/api/guilds/:id/bot-profile', auth, async (req, res) => {
        const id = String(req.params.id);
        if (!canManageGuild(req.user, id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const nick = String(req.body?.nickname ?? '').trim();
        if (nick.length > 32)
            return jsonError(res, 400, 'Discord bot nicknames must be 32 characters or fewer.');
        try {
            const member = await botApi(`/guilds/${id}/members/@me`, {
                method: 'PATCH', throwOnError: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nick: nick || null })
            });
            (0, db_js_1.auditDashboard)(req.user.id, 'guild.bot_nickname.update', id, { nickname: nick || null });
            res.json({ ok: true, nickname: member?.nick || '', message: nick ? `Auralis nickname updated to “${nick}”.` : 'Auralis nickname reset to its username.' });
        }
        catch (error) {
            jsonError(res, 502, `Discord could not update Auralis nickname. Check the Change Nickname permission and bot role position. ${error.message}`);
        }
    });
    app.get('/api/guilds/:id/resources', auth, async (req, res) => {
        const id = req.params.id;
        if (!canManageGuild(req.user, id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const [channels, roles] = await Promise.all([botApi(`/guilds/${id}/channels`), botApi(`/guilds/${id}/roles`)]);
        const sortedRoles = (Array.isArray(roles) ? roles : []).sort((a, b) => Number(b.position || 0) - Number(a.position || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'en'));
        res.set('Cache-Control', 'no-store');
        res.json({ channels: Array.isArray(channels) ? channels : [], roles: sortedRoles });
    });
    app.get('/api/guilds/:id/webhooks', auth, async (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        try {
            const webhooks = await botApi(`/guilds/${guildId}/webhooks`, { throwOnError: true });
            const safeWebhooks = (Array.isArray(webhooks) ? webhooks : []).map(webhook => ({
                id: String(webhook.id), name: String(webhook.name || 'Webhook'), channelId: String(webhook.channel_id || ''),
                avatar: webhook.avatar || null, applicationId: webhook.application_id || null,
                user: webhook.user ? { id: String(webhook.user.id), username: String(webhook.user.username || '') } : null,
                type: Number(webhook.type || 1)
            }));
            res.set('Cache-Control', 'no-store');
            res.json({ webhooks: safeWebhooks });
        }
        catch (error) {
            jsonError(res, 502, `Could not load webhooks. Check that Auralis has Manage Webhooks. ${error.message}`);
        }
    });
    app.post('/api/guilds/:id/webhooks', auth, async (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const channelId = String(req.body?.channelId || '');
        const name = String(req.body?.name || '').trim().replace(/[\r\n\t]/g, ' ').slice(0, 80);
        if (!/^\d{17,20}$/.test(channelId))
            return jsonError(res, 400, 'Choose a channel from this server.');
        if (name.length < 2)
            return jsonError(res, 400, 'Webhook names must contain at least two characters.');
        try {
            const channels = await botApi(`/guilds/${guildId}/channels`, { throwOnError: true });
            const channel = Array.isArray(channels) ? channels.find(item => String(item.id) === channelId) : null;
            if (!channel || ![0, 5].includes(Number(channel.type)))
                return jsonError(res, 400, 'Choose a text or announcement channel in this server.');
            const webhook = await botApi(`/channels/${channelId}/webhooks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), throwOnError: true });
            (0, db_js_1.auditDashboard)(req.user.id, 'webhook.create', guildId, { webhookId: webhook.id, channelId, name });
            res.status(201).json({ ok: true, webhook: { id: String(webhook.id), name: String(webhook.name || name), channelId: String(webhook.channel_id || channelId), avatar: webhook.avatar || null, applicationId: webhook.application_id || null, type: Number(webhook.type || 1) } });
        }
        catch (error) {
            jsonError(res, 502, `Could not create the webhook. Check Auralis's Manage Webhooks permission and role access. ${error.message}`);
        }
    });
    app.delete('/api/guilds/:id/webhooks/:webhookId', auth, async (req, res) => {
        const guildId = String(req.params.id);
        const webhookId = String(req.params.webhookId || '');
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        if (!/^\d{17,20}$/.test(webhookId))
            return jsonError(res, 400, 'Choose a valid webhook.');
        try {
            const webhooks = await botApi(`/guilds/${guildId}/webhooks`, { throwOnError: true });
            const webhook = Array.isArray(webhooks) ? webhooks.find(item => String(item.id) === webhookId) : null;
            if (!webhook)
                return jsonError(res, 404, 'That webhook does not belong to this server or no longer exists.');
            await botApi(`/webhooks/${webhookId}`, { method: 'DELETE', throwOnError: true });
            (0, db_js_1.auditDashboard)(req.user.id, 'webhook.delete', guildId, { webhookId, channelId: webhook.channel_id || null, name: webhook.name || null });
            res.json({ ok: true, deletedId: webhookId });
        }
        catch (error) {
            jsonError(res, 502, `Could not delete webhook. ${error.message}`);
        }
    });
    app.get('/api/guilds/:id/autoroles', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        res.json({ roleIds: (0, community_js_1.listAutoroles)(guildId) });
    });
    app.post('/api/guilds/:id/autoroles', auth, async (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const roleId = String(req.body?.roleId ?? '');
        if (!/^\d{17,20}$/.test(roleId) || roleId === guildId)
            return jsonError(res, 400, 'Select a valid, assignable server role.');
        const roles = await botApi(`/guilds/${guildId}/roles`, { throwOnError: true }).catch(error => ({ __error: error.message }));
        if (roles?.__error)
            return jsonError(res, 502, roles.__error);
        if (!Array.isArray(roles) || !roles.some(role => String(role.id) === roleId))
            return jsonError(res, 400, 'The selected role does not belong to this server.');
        (0, community_js_1.addAutorole)(guildId, roleId);
        (0, db_js_1.auditDashboard)(req.user.id, 'autorole.add', guildId, { roleId });
        res.json({ ok: true, roleIds: (0, community_js_1.listAutoroles)(guildId) });
    });
    app.delete('/api/guilds/:id/autoroles/:roleId', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const roleId = String(req.params.roleId ?? '');
        if (!/^\d{17,20}$/.test(roleId))
            return jsonError(res, 400, 'Select a valid server role.');
        (0, community_js_1.removeAutorole)(guildId, roleId);
        (0, db_js_1.auditDashboard)(req.user.id, 'autorole.remove', guildId, { roleId });
        res.json({ ok: true, roleIds: (0, community_js_1.listAutoroles)(guildId) });
    });
    app.get('/api/guilds/:id/image-only-channels', auth, (req, res) => {
        const id = req.params.id;
        if (!canManageGuild(req.user, id))
            return jsonError(res, 403, 'You cannot manage this server.');
        res.json({ channels: (0, community_js_1.imageOnlyList)(id).map(row => ({ channelId: row.channel_id })) });
    });
    app.post('/api/guilds/:id/image-only-channels', auth, async (req, res) => {
        const id = req.params.id;
        if (!canManageGuild(req.user, id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const channelId = String(req.body?.channelId ?? '');
        if (!/^\d{17,20}$/.test(channelId))
            return jsonError(res, 400, 'Select a valid text channel.');
        const channels = await botApi(`/guilds/${id}/channels`);
        const channel = Array.isArray(channels) ? channels.find(item => item.id === channelId) : null;
        if (!channel || ![0, 5].includes(Number(channel.type)))
            return jsonError(res, 400, 'The selected channel is not a supported text channel.');
        (0, community_js_1.toggleImageOnly)(id, channelId, true);
        res.json({ ok: true, channels: (0, community_js_1.imageOnlyList)(id).map(row => ({ channelId: row.channel_id })) });
    });
    app.delete('/api/guilds/:id/image-only-channels/:channelId', auth, (req, res) => {
        const id = req.params.id;
        if (!canManageGuild(req.user, id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const channelId = String(req.params.channelId ?? '');
        if (!/^\d{17,20}$/.test(channelId))
            return jsonError(res, 400, 'Invalid channel ID.');
        (0, community_js_1.toggleImageOnly)(id, channelId, false);
        res.json({ ok: true, channels: (0, community_js_1.imageOnlyList)(id).map(row => ({ channelId: row.channel_id })) });
    });
    app.get('/api/guilds/:id/tickets', auth, (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const rows = db_js_1.db.prepare('SELECT * FROM tickets WHERE guild_id=? ORDER BY created_at DESC LIMIT 100').all(req.params.id);
        res.json({ tickets: rows });
    });
    app.get('/api/guilds/:id/applications', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const allowed = new Set(['all', 'pending', 'reviewing', 'accepted', 'rejected']);
        const status = String(req.query.status || 'all');
        if (!allowed.has(status))
            return jsonError(res, 400, 'Unsupported application status filter.');
        const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
        db_js_1.db.prepare('DELETE FROM application_drafts WHERE expires_at<=?').run(Date.now());
        const rows = status === 'all'
            ? db_js_1.db.prepare('SELECT * FROM applications WHERE guild_id=? ORDER BY created_at DESC LIMIT ?').all(guildId, limit)
            : db_js_1.db.prepare('SELECT * FROM applications WHERE guild_id=? AND status=? ORDER BY created_at DESC LIMIT ?').all(guildId, status, limit);
        const activeDrafts = Number(db_js_1.db.prepare('SELECT COUNT(*) AS count FROM application_drafts WHERE guild_id=? AND expires_at>?').get(guildId, Date.now())?.count || 0);
        const forms = (0, db_js_1.getGuildConfig)(guildId).applicationDefaults?.forms || {};
        const applications = rows.map(row => {
            let answers = [];
            try {
                answers = JSON.parse(row.answers || '[]');
            }
            catch { }
            const form = forms[row.type] || {};
            return { ...row, answers, title: String(form.title || row.type || 'Application'), reviewReason: row.review_reason || '' };
        });
        const counts = db_js_1.db.prepare('SELECT status, COUNT(*) AS count FROM applications WHERE guild_id=? GROUP BY status').all(guildId);
        const byStatus = Object.fromEntries(counts.map(row => [row.status, Number(row.count)]));
        res.json({
            applications,
            stats: {
                total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
                activeDrafts,
                pending: (byStatus.pending || 0) + (byStatus.reviewing || 0),
                reviewing: byStatus.reviewing || 0,
                accepted: byStatus.accepted || 0,
                rejected: byStatus.rejected || 0
            }
        });
    });
    app.put('/api/guilds/:id/applications/forms', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const source = req.body?.forms;
        if (!source || typeof source !== 'object' || Array.isArray(source))
            return jsonError(res, 400, 'Forms must be an object keyed by an application ID.');
        const entries = Object.entries(source);
        if (entries.length < 1 || entries.length > 500)
            return jsonError(res, 400, 'Configure between one and 500 application forms in the form library. Each Discord panel can display up to 25 forms.');
        const forms = {};
        for (const [rawId, rawForm] of entries) {
            const id = String(rawId).trim().toLowerCase();
            if (!/^[a-z0-9_-]{1,40}$/.test(id))
                return jsonError(res, 400, `Invalid form ID “${id}”. Use letters, numbers, underscores and hyphens.`);
            const title = String(rawForm?.title || '').trim().slice(0, 80);
            const description = String(rawForm?.description || '').trim().slice(0, 3000);
            const questions = Array.isArray(rawForm?.questions) ? rawForm.questions.map(value => String(value).trim()).filter(Boolean) : [];
            const allowedStyles = new Set(['PRIMARY', 'SECONDARY', 'SUCCESS', 'DANGER']);
            const requestedStyle = String(rawForm?.buttonStyle || 'PRIMARY').toUpperCase();
            const buttonStyle = allowedStyles.has(requestedStyle) ? requestedStyle : 'PRIMARY';
            const buttonEmoji = String(rawForm?.buttonEmoji || '').trim().slice(0, 16);
            if (!title)
                return jsonError(res, 400, `Form “${id}” needs a title.`);
            if (questions.length < 1 || questions.length > 5)
                return jsonError(res, 400, `Form “${title}” must have one to five questions.`);
            if (questions.some(question => question.length > 45))
                return jsonError(res, 400, `Every Discord modal question in “${title}” must be at most 45 characters.`);
            const buttonLabel = String(rawForm?.buttonLabel || title).trim().slice(0, 80);
            forms[id] = { title, description, questions, buttonLabel: buttonLabel || title, buttonStyle, buttonEmoji };
        }
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        const previousIds = Object.keys(cfg.applicationDefaults?.forms || {});
        cfg.applicationDefaults.forms = forms;
        cfg.applicationDefaults.panelSets ||= {};
        for (const [panelId, panel] of Object.entries(cfg.applicationDefaults.panelSets)) {
            const configured = Array.isArray(panel?.formIds) ? panel.formIds.map(String) : [];
            const wasAutoDefault = panelId === 'default' && configured.every(id => previousIds.includes(id)) && configured.length === previousIds.length;
            panel.formIds = wasAutoDefault ? Object.keys(forms).slice(0, 25) : configured.filter(id => Object.prototype.hasOwnProperty.call(forms, id)).slice(0, 25);
        }
        (0, db_js_1.saveGuildConfig)(guildId, cfg);
        (0, db_js_1.auditDashboard)(req.user.id, 'applications.forms.update', guildId, { formIds: Object.keys(forms), formCount: entries.length });
        res.json({ ok: true, forms });
    });
    function normalizeApplicationPanelSet(input, fallbackId) {
        const id = String(input?.id || fallbackId || '').trim().toLowerCase();
        if (!/^[a-z0-9_-]{1,40}$/.test(id))
            throw new Error('Panel ID must use letters, numbers, underscores or hyphens (max 40 characters).');
        const name = String(input?.name || id).trim().slice(0, 80);
        const title = String(input?.title || 'Applications').trim().slice(0, 256);
        const description = String(input?.description || 'Choose an application type below to open the form.').trim().slice(0, 4096);
        const formIds = Array.isArray(input?.formIds) ? [...new Set(input.formIds.map(value => String(value).trim()))].filter(Boolean) : [];
        const channelId = input?.channelId ? String(input.channelId) : null;
        if (channelId && !/^\d{17,20}$/.test(channelId))
            throw new Error('Choose a valid Discord text channel for this panel.');
        if (!name || !title)
            throw new Error('Panel name and title are required.');
        if (formIds.length > 25)
            throw new Error('A single Discord application panel can show at most 25 form buttons across five rows.');
        return { id, name, title, description, formIds, channelId };
    }
    app.get('/api/guilds/:id/application-panels', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        cfg.applicationDefaults.panelSets ||= {};
        const forms = cfg.applicationDefaults.forms || {};
        let changed = false;
        if (!cfg.applicationDefaults.panelSets.default) {
            cfg.applicationDefaults.panelSets.default = { id: 'default', name: 'Default applications', title: cfg.panels?.applications?.title || 'Applications', description: cfg.panels?.applications?.description || 'Choose an application type below to open the form.', formIds: Object.keys(forms).slice(0, 25) };
            changed = true;
        }
        const defaultPanel = cfg.applicationDefaults.panelSets.default;
        if (defaultPanel && !defaultPanel.title) {
            defaultPanel.title = cfg.panels?.applications?.title || 'Applications';
            changed = true;
        }
        if (defaultPanel && !defaultPanel.description) {
            defaultPanel.description = cfg.panels?.applications?.description || 'Choose an application type below to open the form.';
            changed = true;
        }
        if (changed)
            (0, db_js_1.saveGuildConfig)(guildId, cfg);
        const panels = Object.values(cfg.applicationDefaults.panelSets).map(panel => ({ ...panel, formIds: (Array.isArray(panel.formIds) && panel.formIds.length ? panel.formIds : Object.keys(forms).slice(0, 25)).filter(id => Object.prototype.hasOwnProperty.call(forms, id)).slice(0, 25) }));
        res.json({ panels, forms: Object.entries(forms).map(([id, form]) => ({ id, title: String(form.title || id) })), limits: { maxPanels: 500, maxForms: 500, maxFormsPerPanel: 25 } });
    });
    app.post('/api/guilds/:id/application-panels', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        const panels = cfg.applicationDefaults.panelSets ||= {};
        if (Object.keys(panels).length >= 500)
            return jsonError(res, 400, 'This server has reached the configured limit of 500 application panel sets.');
        try {
            const panel = normalizeApplicationPanelSet(req.body, `applications-${Date.now().toString(36)}`);
            if (panels[panel.id])
                return jsonError(res, 409, 'An application panel with that ID already exists.');
            const forms = cfg.applicationDefaults.forms || {};
            if (panel.formIds.some(id => !Object.prototype.hasOwnProperty.call(forms, id)))
                return jsonError(res, 400, 'Every selected form must exist in the form library.');
            panels[panel.id] = panel;
            (0, db_js_1.saveGuildConfig)(guildId, cfg);
            (0, db_js_1.auditDashboard)(req.user.id, 'applications.panel.create', guildId, { panelId: panel.id, formCount: panel.formIds.length });
            res.json({ ok: true, panel, panels: Object.values(panels) });
        }
        catch (error) {
            jsonError(res, 400, error instanceof Error ? error.message : 'Invalid application panel.');
        }
    });
    app.patch('/api/guilds/:id/application-panels/:panelId', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        const panels = cfg.applicationDefaults.panelSets ||= {};
        const old = panels[String(req.params.panelId)];
        if (!old)
            return jsonError(res, 404, 'Application panel not found.');
        try {
            const panel = normalizeApplicationPanelSet({ ...old, ...(req.body || {}), id: old.id }, old.id);
            const forms = cfg.applicationDefaults.forms || {};
            if (panel.formIds.some(id => !Object.prototype.hasOwnProperty.call(forms, id)))
                return jsonError(res, 400, 'Every selected form must exist in the form library.');
            panels[panel.id] = panel;
            if (panel.id === 'default') {
                cfg.panels ||= {};
                cfg.panels.applications ||= {};
                cfg.panels.applications.title = panel.title;
                cfg.panels.applications.description = panel.description;
            }
            (0, db_js_1.saveGuildConfig)(guildId, cfg);
            (0, db_js_1.auditDashboard)(req.user.id, 'applications.panel.update', guildId, { panelId: panel.id, formCount: panel.formIds.length });
            res.json({ ok: true, panel, panels: Object.values(panels) });
        }
        catch (error) {
            jsonError(res, 400, error instanceof Error ? error.message : 'Invalid application panel.');
        }
    });
    app.delete('/api/guilds/:id/application-panels/:panelId', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        const panels = cfg.applicationDefaults.panelSets ||= {};
        const id = String(req.params.panelId);
        if (id === 'default')
            return jsonError(res, 400, 'The default application panel cannot be deleted.');
        if (!panels[id])
            return jsonError(res, 404, 'Application panel not found.');
        delete panels[id];
        (0, db_js_1.saveGuildConfig)(guildId, cfg);
        (0, db_js_1.auditDashboard)(req.user.id, 'applications.panel.delete', guildId, { panelId: id });
        res.json({ ok: true, panels: Object.values(panels) });
    });
    app.post('/api/guilds/:id/application-panels/:panelId/send', auth, async (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const channelId = String(req.body?.channelId || '');
        if (!/^\d{17,20}$/.test(channelId))
            return jsonError(res, 400, 'Choose a valid text channel.');
        const channel = await botApi(`/channels/${channelId}`, { throwOnError: true }).catch(error => ({ __error: error.message }));
        if (channel?.__error)
            return jsonError(res, 502, channel.__error);
        if (!channel || String(channel.guild_id) !== guildId || ![0, 5].includes(Number(channel.type)))
            return jsonError(res, 400, 'The target must be a text or announcement channel in this server.');
        let payload;
        try {
            payload = (0, applications_js_1.buildApplicationPanelRestPayload)(guildId, String(req.params.panelId));
        }
        catch (error) {
            return jsonError(res, 400, error instanceof Error ? error.message : 'Could not build application panel.');
        }
        const posted = await botApi(`/channels/${channelId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), throwOnError: true }).catch(error => ({ __error: error.message }));
        if (posted?.__error)
            return jsonError(res, 502, posted.__error);
        (0, db_js_1.auditDashboard)(req.user.id, 'applications.panel.send', guildId, { panelId: String(req.params.panelId), channelId, messageId: posted.id });
        res.json({ ok: true, panelId: String(req.params.panelId), channelId, messageId: posted.id, url: `https://discord.com/channels/${guildId}/${channelId}/${posted.id}` });
    });
    app.patch('/api/guilds/:id/applications/:applicationId', auth, async (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const id = Number(req.params.applicationId);
        if (!Number.isSafeInteger(id) || id < 1)
            return jsonError(res, 400, 'Invalid application ID.');
        const status = String(req.body?.status || '').toLowerCase();
        if (!['reviewing', 'accepted', 'rejected'].includes(status))
            return jsonError(res, 400, 'Choose reviewing, accepted or rejected.');
        const row = db_js_1.db.prepare('SELECT * FROM applications WHERE guild_id=? AND id=?').get(guildId, id);
        if (!row)
            return jsonError(res, 404, 'Application not found.');
        if (!['pending', 'reviewing'].includes(row.status))
            return jsonError(res, 409, `Application #${id} has already been ${row.status}.`);
        const reason = String(req.body?.reason || '').trim().slice(0, 1000);
        db_js_1.db.prepare('UPDATE applications SET status=?,reviewer_id=?,review_reason=? WHERE guild_id=? AND id=?').run(status, req.user.id, reason, guildId, id);
        (0, db_js_1.auditDashboard)(req.user.id, `application.${status}`, guildId, { applicationId: id, applicantId: row.user_id, reason });
        let dmSent = false;
        if (['accepted', 'rejected'].includes(status) && (0, db_js_1.getGuildConfig)(guildId).applicationDefaults?.dmOnDecision !== false) {
            const cfg = (0, db_js_1.getGuildConfig)(guildId);
            const form = cfg.applicationDefaults?.forms?.[row.type] || {};
            const template = status === 'accepted' ? cfg.dmTemplates?.applicationAccepted : cfg.dmTemplates?.applicationRejected;
            const text = (0, core_js_1.replacePlaceholders)(template || `Your application for {type} has been ${status}.`, {
                server: String((await discordBotGuild(guildId))?.name || 'the server'),
                type: String(form.title || row.type), reason: reason || 'No reason provided', moderator: String(req.user.global_name || req.user.username || req.user.id),
                user: `<@${row.user_id}>`, username: String(row.user_id), applicationId: String(id)
            }).slice(0, 1900);
            const dm = await botApi('/users/@me/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient_id: String(row.user_id) }), throwOnError: true }).catch(() => null);
            if (dm?.id) {
                const sent = await botApi(`/channels/${dm.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text, allowed_mentions: { parse: [] } }), throwOnError: true }).catch(() => null);
                dmSent = Boolean(sent?.id);
            }
        }
        const reviewedCfg = (0, db_js_1.getGuildConfig)(guildId);
        const logging = reviewedCfg.loggingDefaults || {};
        const logChannelId = logging.channels?.applications;
        if (logging.enabled !== false && logging.events?.applications !== false && logChannelId) {
            const reviewerName = String(req.user.global_name || req.user.username || req.user.id);
            const form = reviewedCfg.applicationDefaults?.forms?.[row.type] || {};
            await botApi(`/channels/${logChannelId}/messages`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [{ title: `Application ${status}`, description: `Case: **#${id}**\nApplicant: <@${row.user_id}> (\`${row.user_id}\`)\nForm: **${String(form.title || row.type).slice(0, 180)}**\nReviewed by: ${reviewerName}\nReason: ${reason || 'No reason provided'}\nApplicant DM: **${dmSent ? 'Sent' : (['accepted', 'rejected'].includes(status) ? 'Not delivered / disabled' : 'Not sent')}**`, color: status === 'accepted' ? 0x56D68A : status === 'rejected' ? 0xF36B7F : 0x4D9CFF }], allowed_mentions: { parse: [] } }),
                throwOnError: true
            }).catch(error => console.warn(`[Auralis] application review log failed in guild ${guildId}: ${error.message}`));
        }
        res.json({ ok: true, applicationId: id, status, dmSent, message: dmSent ? 'Review saved and applicant notified.' : 'Review saved. A DM may not have been delivered because the user blocks DMs or the bot could not open a DM channel.' });
    });
    app.get('/api/guilds/:id/cases', auth, (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const rows = db_js_1.db.prepare('SELECT * FROM cases WHERE guild_id=? ORDER BY created_at DESC LIMIT 100').all(req.params.id);
        res.json({ cases: rows });
    });
    app.get('/api/guilds/:id/command-permissions', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        const permissions = cfg.commandPermissions ?? {};
        res.json({
            commands: (0, commands_js_1.commandDashboardCatalog)().map(command => ({
                ...command,
                enabled: permissions[command.name]?.enabled !== false,
                roleId: String(permissions[command.name]?.roleId ?? ''),
                permission: String(permissions[command.name]?.permission ?? 'None')
            }))
        });
    });
    app.patch('/api/guilds/:id/command-permissions/:commandName', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const commandName = String(req.params.commandName ?? '').toLowerCase();
        const command = (0, commands_js_1.commandDashboardCatalog)().find(item => item.name === commandName);
        if (!command)
            return jsonError(res, 404, 'Slash command not found.');
        const enabled = req.body?.enabled !== false;
        const roleId = String(req.body?.roleId ?? '');
        const permission = String(req.body?.permission ?? 'None');
        const allowed = new Set(['Administrator', 'ManageGuild', 'ManageMessages', 'ManageChannels', 'ManageRoles', 'ModerateMembers', 'KickMembers', 'BanMembers', 'ViewAuditLog', 'ManageThreads', 'EmbedLinks', 'None']);
        if (roleId && !/^\d{17,20}$/.test(roleId))
            return jsonError(res, 400, 'Select a valid server role.');
        if (!allowed.has(permission))
            return jsonError(res, 400, 'Select a supported Discord permission.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        cfg.commandPermissions ??= {};
        cfg.commandPermissions[commandName] = { enabled, roleId: roleId || null, permission };
        (0, db_js_1.saveGuildConfig)(guildId, cfg);
        (0, db_js_1.auditDashboard)(req.user.id, 'command.permissions.update', guildId, { command: commandName, enabled, roleId: roleId || null, permission });
        res.json({ ok: true, command: cfg.commandPermissions[commandName] });
    });
    app.get('/api/guilds/:id/prefix-commands', auth, (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const rows = db_js_1.db.prepare('SELECT command_name, enabled FROM prefix_commands WHERE guild_id=? ORDER BY command_name').all(req.params.id).map(x => ({ ...x, enabled: Boolean(x.enabled) }));
        res.json({ commands: rows, catalog: config_js_1.config.commandGroups.prefix });
    });
    app.patch('/api/guilds/:id/prefix-commands', auth, (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const body = req.body ?? {};
        for (const [name, enabled] of Object.entries(body)) {
            if (!config_js_1.config.commandGroups.prefix.includes(name) || typeof enabled !== 'boolean')
                continue;
            db_js_1.db.prepare('INSERT INTO prefix_commands(guild_id,command_name,enabled) VALUES(?,?,?) ON CONFLICT(guild_id,command_name) DO UPDATE SET enabled=excluded.enabled').run(req.params.id, name, enabled ? 1 : 0);
        }
        res.json({ ok: true });
    });
    function safeCustomCommandName(value) {
        return String(value ?? '').trim().toLowerCase().replace(/^!+/, '').replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    }
    function safeHttpUrl(value) {
        const raw = String(value ?? '').trim();
        if (!raw)
            return '';
        try {
            const url = new URL(raw);
            return ['https:', 'http:'].includes(url.protocol) ? url.href.slice(0, 512) : '';
        }
        catch {
            return '';
        }
    }
    function parseJsonArray(raw, fallback = []) {
        try {
            const value = JSON.parse(String(raw ?? '[]'));
            return Array.isArray(value) ? value : fallback;
        }
        catch {
            return fallback;
        }
    }
    function customCommandRow(row) {
        return {
            name: row.name,
            response: row.reply,
            createdBy: row.created_by,
            updatedAt: row.updated_at,
            enabled: row.enabled !== 0,
            responseMode: row.response_mode || 'channel',
            replyMode: row.reply_mode || 'reply',
            deleteInvocation: Boolean(row.delete_invocation),
            cooldownSeconds: Number(row.cooldown_seconds || 0),
            allowedRoleIds: parseJsonArray(row.allowed_role_ids),
            requiredPermission: row.required_permission || 'None',
            embed: (() => { try {
                return JSON.parse(row.embed_json || '{}');
            }
            catch {
                return {};
            } })()
        };
    }
    const customPermissionNames = new Set(['None', 'Administrator', 'ManageGuild', 'ManageMessages', 'ManageChannels', 'ManageRoles', 'ModerateMembers', 'KickMembers', 'BanMembers', 'ViewAuditLog', 'ManageThreads']);
    app.get('/api/guilds/:id/custom-commands', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const commands = db_js_1.db.prepare('SELECT * FROM custom_commands WHERE guild_id=? ORDER BY name COLLATE NOCASE').all(guildId).map(customCommandRow);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ commands, count: commands.length, limit: Number(config_js_1.config.limits.maxCustomCommands || 500), prefix: String((0, db_js_1.getGuildConfig)(guildId).discord?.defaultPrefix || config_js_1.config.discord.defaultPrefix || '.') });
    });
    app.post('/api/guilds/:id/custom-commands', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const name = safeCustomCommandName(req.body?.name);
        const response = String(req.body?.response ?? '').trim();
        if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(name))
            return jsonError(res, 400, 'Command names must start with a letter or number and contain only letters, numbers, hyphens or underscores (max 32).');
        if (!response || response.length > 1900)
            return jsonError(res, 400, 'Enter a response between 1 and 1,900 characters.');
        const count = Number(db_js_1.db.prepare('SELECT COUNT(*) AS count FROM custom_commands WHERE guild_id=?').get(guildId)?.count || 0);
        if (count >= Number(config_js_1.config.limits.maxCustomCommands || 500))
            return jsonError(res, 400, `This server has reached the configured limit (${config_js_1.config.limits.maxCustomCommands || 500}). Discord and storage resources are not unlimited.`);
        const roles = Array.isArray(req.body?.allowedRoleIds) ? [...new Set(req.body.allowedRoleIds.map(String).filter(x => /^\d{17,20}$/.test(x)))].slice(0, 50) : [];
        const required = customPermissionNames.has(String(req.body?.requiredPermission || 'None')) ? String(req.body?.requiredPermission || 'None') : 'None';
        const responseMode = req.body?.responseMode === 'dm' ? 'dm' : 'channel';
        const replyMode = req.body?.replyMode === 'channel' ? 'channel' : 'reply';
        const cooldown = Math.max(0, Math.min(3600, Math.trunc(Number(req.body?.cooldownSeconds || 0))));
        const embedIn = req.body?.embed && typeof req.body.embed === 'object' ? req.body.embed : {};
        const embed = {
            enabled: Boolean(embedIn.enabled),
            title: String(embedIn.title || '').slice(0, 256),
            description: String(embedIn.description || '').slice(0, 4096),
            color: String(embedIn.color || '#7C6CF5').match(/^#[0-9a-f]{6}$/i) ? String(embedIn.color) : '#7C6CF5',
            url: safeHttpUrl(embedIn.url),
            authorName: String(embedIn.authorName || '').slice(0, 256),
            authorIconUrl: safeHttpUrl(embedIn.authorIconUrl),
            thumbnailUrl: safeHttpUrl(embedIn.thumbnailUrl),
            imageUrl: safeHttpUrl(embedIn.imageUrl),
            footerText: String(embedIn.footerText || '').slice(0, 2048),
            footerIconUrl: safeHttpUrl(embedIn.footerIconUrl),
            timestamp: Boolean(embedIn.timestamp)
        };
        try {
            db_js_1.db.prepare(`INSERT INTO custom_commands(guild_id,name,reply,created_by,updated_at,enabled,response_mode,reply_mode,delete_invocation,cooldown_seconds,allowed_role_ids,required_permission,embed_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(guildId, name, response, req.user.id, Date.now(), req.body?.enabled === false ? 0 : 1, responseMode, replyMode, req.body?.deleteInvocation ? 1 : 0, cooldown, JSON.stringify(roles), required, JSON.stringify(embed));
        }
        catch (error) {
            if (/UNIQUE|PRIMARY KEY/i.test(String(error.message)))
                return jsonError(res, 409, `The command “${name}” already exists.`);
            throw error;
        }
        (0, db_js_1.auditDashboard)(req.user.id, 'custom-command.create', guildId, { name });
        res.status(201).json({ ok: true, command: customCommandRow(db_js_1.db.prepare('SELECT * FROM custom_commands WHERE guild_id=? AND name=?').get(guildId, name)) });
    });
    app.patch('/api/guilds/:id/custom-commands/:name', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const name = safeCustomCommandName(req.params.name);
        const current = db_js_1.db.prepare('SELECT * FROM custom_commands WHERE guild_id=? AND name=?').get(guildId, name);
        if (!current)
            return jsonError(res, 404, 'Custom command not found.');
        const source = { ...customCommandRow(current), ...req.body };
        const response = String(source.response ?? '').trim();
        if (!response || response.length > 1900)
            return jsonError(res, 400, 'Enter a response between 1 and 1,900 characters.');
        const roles = Array.isArray(source.allowedRoleIds) ? [...new Set(source.allowedRoleIds.map(String).filter(x => /^\d{17,20}$/.test(x)))].slice(0, 50) : [];
        const required = customPermissionNames.has(String(source.requiredPermission || 'None')) ? String(source.requiredPermission || 'None') : 'None';
        const responseMode = source.responseMode === 'dm' ? 'dm' : 'channel';
        const replyMode = source.replyMode === 'channel' ? 'channel' : 'reply';
        const cooldown = Math.max(0, Math.min(3600, Math.trunc(Number(source.cooldownSeconds || 0))));
        const embedIn = source.embed && typeof source.embed === 'object' ? source.embed : {};
        const embed = { enabled: Boolean(embedIn.enabled), title: String(embedIn.title || '').slice(0, 256), description: String(embedIn.description || '').slice(0, 4096), color: String(embedIn.color || '#7C6CF5').match(/^#[0-9a-f]{6}$/i) ? String(embedIn.color) : '#7C6CF5', url: safeHttpUrl(embedIn.url), authorName: String(embedIn.authorName || '').slice(0, 256), authorIconUrl: safeHttpUrl(embedIn.authorIconUrl), thumbnailUrl: safeHttpUrl(embedIn.thumbnailUrl), imageUrl: safeHttpUrl(embedIn.imageUrl), footerText: String(embedIn.footerText || '').slice(0, 2048), footerIconUrl: safeHttpUrl(embedIn.footerIconUrl), timestamp: Boolean(embedIn.timestamp) };
        db_js_1.db.prepare(`UPDATE custom_commands SET reply=?,updated_at=?,enabled=?,response_mode=?,reply_mode=?,delete_invocation=?,cooldown_seconds=?,allowed_role_ids=?,required_permission=?,embed_json=? WHERE guild_id=? AND name=?`)
            .run(response, Date.now(), source.enabled === false ? 0 : 1, responseMode, replyMode, source.deleteInvocation ? 1 : 0, cooldown, JSON.stringify(roles), required, JSON.stringify(embed), guildId, name);
        (0, db_js_1.auditDashboard)(req.user.id, 'custom-command.update', guildId, { name });
        res.json({ ok: true, command: customCommandRow(db_js_1.db.prepare('SELECT * FROM custom_commands WHERE guild_id=? AND name=?').get(guildId, name)) });
    });
    app.delete('/api/guilds/:id/custom-commands/:name', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const name = safeCustomCommandName(req.params.name);
        const result = db_js_1.db.prepare('DELETE FROM custom_commands WHERE guild_id=? AND name=?').run(guildId, name);
        if (!result.changes)
            return jsonError(res, 404, 'Custom command not found.');
        (0, db_js_1.auditDashboard)(req.user.id, 'custom-command.delete', guildId, { name });
        res.json({ ok: true, message: `Custom command “${name}” removed.` });
    });
    function normalizeEmbedPreset(input, idFallback = `embed-${Date.now().toString(36)}`) {
        const source = input && typeof input === 'object' ? input : {};
        const id = String(source.id || idFallback).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40);
        const color = String(source.color || '#7C6CF5');
        const fields = Array.isArray(source.fields) ? source.fields.slice(0, 25).map(field => ({ name: String(field?.name || 'Field').slice(0, 256), value: String(field?.value || '—').slice(0, 1024), inline: Boolean(field?.inline) })) : [];
        return { id, name: String(source.name || id).trim().slice(0, 80), enabled: source.enabled !== false, title: String(source.title || '').slice(0, 256), description: String(source.description || '').slice(0, 4096), color: color.match(/^#[0-9a-f]{6}$/i) ? color : '#7C6CF5', url: safeHttpUrl(source.url), authorName: String(source.authorName || '').slice(0, 256), authorIconUrl: safeHttpUrl(source.authorIconUrl), thumbnailUrl: safeHttpUrl(source.thumbnailUrl), imageUrl: safeHttpUrl(source.imageUrl), footerText: String(source.footerText || '').slice(0, 2048), footerIconUrl: safeHttpUrl(source.footerIconUrl), timestamp: Boolean(source.timestamp), content: String(source.content || '').slice(0, 1900), fields };
    }
    app.get('/api/guilds/:id/embed-presets', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        const presets = Array.isArray(cfg.customEmbedPresets) ? cfg.customEmbedPresets : [];
        res.setHeader('Cache-Control', 'no-store');
        res.json({ presets, limit: 500 });
    });
    app.post('/api/guilds/:id/embed-presets', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        cfg.customEmbedPresets = Array.isArray(cfg.customEmbedPresets) ? cfg.customEmbedPresets : [];
        if (cfg.customEmbedPresets.length >= 500)
            return jsonError(res, 400, 'This server has reached 500 saved embed presets.');
        const preset = normalizeEmbedPreset(req.body);
        if (!preset.id || !preset.name)
            return jsonError(res, 400, 'A preset ID and name are required.');
        if (cfg.customEmbedPresets.some(p => p.id === preset.id))
            return jsonError(res, 409, 'An embed preset with that ID already exists.');
        if (!preset.title && !preset.description && !preset.fields.length && !preset.imageUrl && !preset.thumbnailUrl)
            return jsonError(res, 400, 'Add a title, description, field, thumbnail or image before saving.');
        cfg.customEmbedPresets.push(preset);
        (0, db_js_1.saveGuildConfig)(guildId, cfg);
        (0, db_js_1.auditDashboard)(req.user.id, 'embed-preset.create', guildId, { id: preset.id });
        res.status(201).json({ ok: true, preset, presets: cfg.customEmbedPresets });
    });
    app.patch('/api/guilds/:id/embed-presets/:presetId', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        cfg.customEmbedPresets = Array.isArray(cfg.customEmbedPresets) ? cfg.customEmbedPresets : [];
        const idx = cfg.customEmbedPresets.findIndex(p => p.id === String(req.params.presetId));
        if (idx < 0)
            return jsonError(res, 404, 'Embed preset not found.');
        const preset = normalizeEmbedPreset({ ...cfg.customEmbedPresets[idx], ...(req.body || {}), id: cfg.customEmbedPresets[idx].id });
        if (!preset.title && !preset.description && !preset.fields.length && !preset.imageUrl && !preset.thumbnailUrl)
            return jsonError(res, 400, 'Add a title, description, field, thumbnail or image before saving.');
        cfg.customEmbedPresets[idx] = preset;
        (0, db_js_1.saveGuildConfig)(guildId, cfg);
        (0, db_js_1.auditDashboard)(req.user.id, 'embed-preset.update', guildId, { id: preset.id });
        res.json({ ok: true, preset, presets: cfg.customEmbedPresets });
    });
    app.delete('/api/guilds/:id/embed-presets/:presetId', auth, (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        const before = Array.isArray(cfg.customEmbedPresets) ? cfg.customEmbedPresets : [];
        cfg.customEmbedPresets = before.filter(p => p.id !== String(req.params.presetId));
        if (cfg.customEmbedPresets.length === before.length)
            return jsonError(res, 404, 'Embed preset not found.');
        (0, db_js_1.saveGuildConfig)(guildId, cfg);
        (0, db_js_1.auditDashboard)(req.user.id, 'embed-preset.delete', guildId, { id: String(req.params.presetId) });
        res.json({ ok: true, presets: cfg.customEmbedPresets });
    });
    app.post('/api/guilds/:id/embed-presets/:presetId/send', auth, async (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        const preset = (cfg.customEmbedPresets || []).find(p => p.id === String(req.params.presetId));
        if (!preset)
            return jsonError(res, 404, 'Embed preset not found.');
        const channelId = String(req.body?.channelId || '');
        if (!/^\d{17,20}$/.test(channelId))
            return jsonError(res, 400, 'Choose a valid text channel.');
        const channelList = await botApi(`/guilds/${guildId}/channels`, { throwOnError: true }).catch(e => ({ __error: e.message }));
        if (channelList?.__error)
            return jsonError(res, 502, channelList.__error);
        const channel = Array.isArray(channelList) ? channelList.find(c => String(c.id) === channelId) : null;
        if (!channel || ![0, 5, 15, 16].includes(Number(channel.type)))
            return jsonError(res, 400, 'The selected channel is not a text, announcement, forum or media channel.');
        const embed = { color: (0, core_js_1.safeHexColor)(preset.color, config_js_1.config.brand.primary) };
        if (preset.title)
            embed.title = preset.title;
        if (preset.description)
            embed.description = preset.description;
        if (preset.url)
            embed.url = preset.url;
        if (preset.authorName)
            embed.author = { name: preset.authorName, ...(preset.authorIconUrl ? { icon_url: preset.authorIconUrl } : {}) };
        if (preset.thumbnailUrl)
            embed.thumbnail = { url: preset.thumbnailUrl };
        if (preset.imageUrl)
            embed.image = { url: preset.imageUrl };
        if (preset.footerText)
            embed.footer = { text: preset.footerText, ...(preset.footerIconUrl ? { icon_url: preset.footerIconUrl } : {}) };
        if (preset.timestamp)
            embed.timestamp = new Date().toISOString();
        if (preset.fields?.length)
            embed.fields = preset.fields.slice(0, 25);
        const payload = { embeds: [embed], allowed_mentions: { parse: [] } };
        if (preset.content)
            payload.content = preset.content;
        const sent = await botApi(`/channels/${channelId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), throwOnError: true }).catch(e => ({ __error: e.message }));
        if (sent?.__error)
            return jsonError(res, 502, sent.__error);
        (0, db_js_1.auditDashboard)(req.user.id, 'embed-preset.send', guildId, { id: preset.id, channelId, messageId: sent.id });
        res.json({ ok: true, messageId: sent.id, channelId, url: `https://discord.com/channels/${guildId}/${channelId}/${sent.id}` });
    });
    app.patch('/api/guilds/:id/config', auth, (req, res) => {
        const id = req.params.id;
        if (!canManageGuild(req.user, id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const incoming = req.body && typeof req.body === 'object' ? req.body : {};
        const current = (0, db_js_1.getGuildConfig)(id);
        for (const section of config_js_1.config.dashboardSecurity.allowedPatchSections) {
            if (!(section in incoming))
                continue;
            const value = incoming[section];
            if (value && typeof value === 'object' && !Array.isArray(value) && current[section] && typeof current[section] === 'object' && !Array.isArray(current[section]))
                (0, db_js_1.mergeDeep)(current[section], value);
            else
                current[section] = value;
        }
        (0, db_js_1.saveGuildConfig)(id, current);
        res.json({ ok: true, config: current });
    });
    app.put('/api/guilds/:id/config/raw', auth, (req, res) => {
        const id = req.params.id;
        if (!config_js_1.config.dashboardSecurity.allowRawConfigImport)
            return jsonError(res, 403, 'Raw config import is disabled.');
        if (!canManageGuild(req.user, id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const incoming = req.body;
        if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming))
            return jsonError(res, 400, 'Configuration must be a JSON object.');
        const base = (0, db_js_1.getGuildConfig)(id);
        delete incoming.dashboardAccess;
        delete incoming.dashboardSecurity;
        const next = (0, db_js_1.mergeDeep)(base, incoming);
        (0, db_js_1.saveGuildConfig)(id, next);
        res.json({ ok: true, config: next });
    });
    app.get('/api/guilds/:id/config/raw', auth, (req, res) => {
        const id = req.params.id;
        if (!config_js_1.config.dashboardSecurity.allowRawConfigExport || !canManageGuild(req.user, id))
            return jsonError(res, 403, 'Raw config access is disabled.');
        res.json((0, db_js_1.getGuildConfig)(id));
    });
    function normalizePanelForApi(panel, fallbackId = 'panel') {
        const p = { ...(panel || {}) };
        p.id = String(p.id || fallbackId).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
        p.name = String(p.name || p.id).trim().slice(0, 80);
        p.title = String(p.title || 'Support Center').slice(0, 256);
        p.description = String(p.description || '').slice(0, 4000);
        p.content = String(p.content || '').slice(0, 2000);
        p.enabled = p.enabled !== false;
        p.channelId = p.channelId ? String(p.channelId) : null;
        p.color = p.color ?? config_js_1.config.brand.primary;
        p.components = Array.isArray(p.components) ? p.components.slice(0, 25).map((c, i) => ({
            id: String(c?.id || `component-${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40),
            type: String(c?.type || 'button').toLowerCase(),
            label: String(c?.label || '').slice(0, 80),
            emoji: (0, core_js_1.safeComponentEmoji)(c?.emoji)?.name ? String(c.emoji).slice(0, 100) : '',
            style: String(c?.style || 'SECONDARY').toUpperCase(),
            action: String(c?.action || 'message').toLowerCase(),
            ticketType: String(c?.ticketType || 'support').slice(0, 40),
            response: String(c?.response || '').slice(0, 1900),
            url: String(c?.url || '').slice(0, 512),
            placeholder: String(c?.placeholder || 'Choose an option').slice(0, 150),
            minValues: Math.max(0, Math.min(25, Number(c?.minValues ?? 1))),
            maxValues: Math.max(1, Math.min(25, Number(c?.maxValues ?? 1))),
            row: Math.max(0, Math.min(4, Number(c?.row ?? 0))),
            disabled: Boolean(c?.disabled),
            options: Array.isArray(c?.options) ? c.options.slice(0, 25).map((o, j) => ({ label: String(o?.label || `Option ${j + 1}`).slice(0, 100), value: String(o?.value || `option-${j + 1}`).slice(0, 100), description: String(o?.description || '').slice(0, 100), emoji: (0, core_js_1.safeComponentEmoji)(o?.emoji)?.name ? String(o.emoji).slice(0, 100) : '', default: Boolean(o?.default), ticketType: String(o?.ticketType || '').slice(0, 40) })) : []
        })) : [];
        return p;
    }
    function panelLimits(cfg) { const stored = cfg.ticketDefaults?.panelLimits || {}; return { ...config_js_1.config.ticketDefaults.panelLimits, ...stored, maxPanels: Math.max(500, Number(stored.maxPanels || 0)) }; }
    function validatePanelCollection(cfg, panels) {
        const limits = panelLimits(cfg);
        if (!Array.isArray(panels))
            throw new Error('Panels must be an array.');
        if (panels.length < limits.minPanels || panels.length > limits.maxPanels)
            throw new Error(`Panels must contain between ${limits.minPanels} and ${limits.maxPanels} entries.`);
        for (const panel of panels) {
            if (!panel.id || !panel.name)
                throw new Error('Every panel needs an ID and name.');
            if (panel.components.length < limits.minComponents || panel.components.length > limits.maxComponents)
                throw new Error(`Panel ${panel.name} has an invalid component count.`);
            const ids = new Set();
            const rowCounts = new Map();
            const rowTypes = new Map();
            for (const component of panel.components) {
                if (ids.has(component.id))
                    throw new Error(`Duplicate component ID in ${panel.name}: ${component.id}`);
                ids.add(component.id);
                if (!['button', 'link', 'string_select', 'user_select', 'role_select', 'channel_select', 'mentionable_select'].includes(component.type))
                    throw new Error(`Unsupported component type: ${component.type}`);
                rowCounts.set(component.row, (rowCounts.get(component.row) || 0) + 1);
                if (rowCounts.get(component.row) > limits.maxButtonsPerRow)
                    throw new Error(`Too many components in row ${component.row + 1} of ${panel.name}.`);
                const rowType = String(component.type).endsWith('_select') ? 'select' : 'button';
                if (rowTypes.has(component.row) && rowTypes.get(component.row) !== rowType)
                    throw new Error(`Row ${component.row + 1} in ${panel.name} cannot mix buttons and dropdowns. Move the dropdown to its own row.`);
                rowTypes.set(component.row, rowType);
                const selectInRow = panel.components.filter(c => Number(c.row) === Number(component.row) && String(c.type).endsWith('_select')).length;
                if (selectInRow > limits.maxSelectsPerRow)
                    throw new Error(`Only ${limits.maxSelectsPerRow} select menu is allowed in row ${component.row + 1}.`);
                if (component.type === 'string_select' && component.options.length > limits.maxOptionsPerSelect)
                    throw new Error(`Too many options in ${component.id}.`);
                if (component.type === 'string_select' && component.options.length === 0)
                    throw new Error(`String dropdown ${component.id} needs at least one option.`);
                if (component.type.endsWith('_select')) {
                    const min = Math.max(0, Number(component.minValues ?? 1));
                    const max = Math.max(1, Number(component.maxValues ?? 1));
                    if (min > max)
                        throw new Error(`${component.id} has an invalid minimum and maximum value.`);
                    if (component.type === 'string_select' && max > component.options.length)
                        throw new Error(`${component.id} cannot allow more selections than available options.`);
                }
                if (component.type === 'link' && !/^https?:\/\//i.test(component.url || ''))
                    throw new Error(`Link button ${component.id} needs a valid http(s) URL.`);
                if (component.type === 'button' && !component.label && !(0, core_js_1.safeComponentEmoji)(component.emoji))
                    throw new Error(`Button ${component.id} needs a label or valid emoji.`);
            }
        }
    }
    app.post('/api/guilds/:id/messages/send', auth, async (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const channelId = String(req.body?.channelId ?? '');
        if (!/^\d{17,20}$/.test(channelId))
            return jsonError(res, 400, 'Choose a valid text channel.');
        const content = (0, core_js_1.truncate)(String(req.body?.content ?? '').trim(), 2000);
        const title = (0, core_js_1.truncate)(String(req.body?.title ?? '').trim(), 256);
        const description = (0, core_js_1.truncate)(String(req.body?.description ?? '').trim(), 4096);
        const footer = (0, core_js_1.truncate)(String(req.body?.footer ?? '').trim(), 2048);
        const url = String(req.body?.url ?? '').trim();
        const image = String(req.body?.image ?? '').trim();
        if (url && !/^https?:\/\//i.test(url))
            return jsonError(res, 400, 'The embed URL must begin with http:// or https://.');
        if (image && !/^https?:\/\//i.test(image))
            return jsonError(res, 400, 'The image URL must begin with http:// or https://.');
        if (!content && !title && !description)
            return jsonError(res, 400, 'Add a message, an embed title, or an embed description.');
        const target = await botApi(`/channels/${channelId}`, { throwOnError: true }).catch(error => ({ __error: error.message }));
        if (target?.__error)
            return jsonError(res, 502, target.__error);
        if (!target || String(target.guild_id) !== guildId || ![0, 5].includes(Number(target.type)))
            return jsonError(res, 400, 'The selected channel must be a text channel in this server.');
        const payload = { allowed_mentions: { parse: [] } };
        if (content)
            payload.content = content;
        if (title || description) {
            const rawColor = String(req.body?.color ?? '').trim();
            const color = rawColor ? (0, core_js_1.safeHexColor)(rawColor, config_js_1.config.brand.primary) : config_js_1.config.brand.primary;
            const embed = { color };
            if (title)
                embed.title = title;
            if (description)
                embed.description = description;
            if (footer)
                embed.footer = { text: footer };
            if (url)
                embed.url = url;
            if (image)
                embed.image = { url: image };
            payload.embeds = [embed];
        }
        const result = await botApi(`/channels/${channelId}/messages`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), throwOnError: true
        }).catch(error => ({ __error: error.message }));
        if (result?.__error)
            return jsonError(res, 502, result.__error);
        if (!result?.id)
            return jsonError(res, 502, 'Discord did not confirm that the message was sent. Check the bot channel permissions.');
        (0, db_js_1.auditDashboard)(req.user.id, 'message.send', guildId, { channelId, messageId: result.id, hasEmbed: Boolean(payload.embeds) });
        res.json({ ok: true, messageId: result.id, channelId, url: `https://discord.com/channels/${guildId}/${channelId}/${result.id}` });
    });
    app.post('/api/guilds/:id/honeypot-warning', auth, async (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const channelId = String(req.body?.channelId ?? '');
        if (!/^\d{17,20}$/.test(channelId))
            return jsonError(res, 400, 'Choose a valid text channel.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        const title = (0, core_js_1.truncate)(String(cfg.honeypotDefaults?.warningTitle || 'DO NOT SEND MESSAGES IN THIS CHANNEL').trim(), 256);
        const description = (0, core_js_1.truncate)(String(cfg.honeypotDefaults?.warningDescription || 'This channel is used to detect spam bots and malicious activity. Do not send messages here. Sending messages may result in a warning, timeout, kick, or ban.').trim(), 4000);
        if (!title && !description)
            return jsonError(res, 400, 'Add a warning title or description first.');
        const target = await botApi(`/channels/${channelId}`, { throwOnError: true }).catch(error => ({ __error: error.message }));
        if (target?.__error)
            return jsonError(res, 502, target.__error);
        if (!target || String(target.guild_id) !== guildId || ![0, 5].includes(Number(target.type)))
            return jsonError(res, 400, 'The selected channel must be a text channel in this server.');
        const colorValue = cfg.brand?.warningColor ?? cfg.brand?.danger ?? config_js_1.config.brand.warning;
        const payload = { allowed_mentions: { parse: [] }, embeds: [{ title: title || undefined, description: description || undefined, color: Number(colorValue) || config_js_1.config.brand.warning }] };
        const posted = await botApi(`/channels/${channelId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), throwOnError: true }).catch(error => ({ __error: error.message }));
        if (posted?.__error)
            return jsonError(res, 502, posted.__error);
        if (!posted?.id)
            return jsonError(res, 502, 'Discord did not confirm that the warning panel was sent. Check the bot channel permissions.');
        (0, db_js_1.auditDashboard)(req.user.id, 'honeypot.warning.send', guildId, { channelId, messageId: posted.id });
        res.json({ ok: true, messageId: posted.id, channelId, url: `https://discord.com/channels/${guildId}/${channelId}/${posted.id}` });
    });
    app.post('/api/guilds/:id/polls', auth, async (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        if (cfg.modules?.polls === false || cfg.pollDefaults?.enabled === false)
            return jsonError(res, 403, 'Polls are disabled. Enable the Polls module in the Dashboard first.');
        const channelId = String(req.body?.channelId ?? '');
        const question = (0, core_js_1.truncate)(String(req.body?.question ?? '').trim(), 500);
        const title = (0, core_js_1.truncate)(String(req.body?.title || cfg.pollDefaults?.title || 'Poll').trim(), 256);
        const description = (0, core_js_1.truncate)(String(req.body?.description ?? cfg.pollDefaults?.description ?? '').trim(), 1000);
        const options = Array.isArray(req.body?.options) ? req.body.options.map(value => String(value).trim()).filter(Boolean).slice(0, 5) : [];
        const durationText = String(req.body?.duration || cfg.pollDefaults?.defaultDuration || '24h').trim();
        const durationMs = (0, core_js_1.parseDuration)(durationText);
        if (!/^\d{17,20}$/.test(channelId))
            return jsonError(res, 400, 'Choose a valid text channel.');
        if (!question)
            return jsonError(res, 400, 'Enter a poll question.');
        if (options.length < 2)
            return jsonError(res, 400, 'Enter at least two poll options, one per line.');
        if (!durationMs || durationMs > 30 * 86400000)
            return jsonError(res, 400, 'Use a valid duration such as 30m, 12h, or 7d. Polls may run for up to 30 days.');
        const target = await botApi(`/channels/${channelId}`, { throwOnError: true }).catch(error => ({ __error: error.message }));
        if (target?.__error)
            return jsonError(res, 502, target.__error);
        if (!target || String(target.guild_id) !== guildId || ![0, 5].includes(Number(target.type)))
            return jsonError(res, 400, 'The selected channel must be a text channel in this server.');
        const draft = {
            message_id: '', guild_id: guildId, channel_id: channelId, creator_id: String(req.user.id),
            title, question, description, options, end_at: Date.now() + durationMs, status: 'active', created_at: Date.now()
        };
        let posted;
        try {
            const initial = restMessagePayload((0, polls_js_1.buildPollMessagePayload)(draft, false));
            posted = await botApi(`/channels/${channelId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(initial), throwOnError: true });
            if (!posted?.id)
                throw new Error('Discord did not return a message ID for the poll.');
            const poll = (0, polls_js_1.registerPoll)({ messageId: posted.id, guildId, channelId, creatorId: req.user.id, title, question, description, options, endAt: draft.end_at });
            const full = restMessagePayload((0, polls_js_1.buildPollMessagePayload)(poll));
            await botApi(`/channels/${channelId}/messages/${posted.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(full), throwOnError: true });
            (0, db_js_1.auditDashboard)(req.user.id, 'poll.create', guildId, { channelId, messageId: posted.id, optionCount: options.length });
            return res.json({ ok: true, messageId: posted.id, channelId, url: `https://discord.com/channels/${guildId}/${channelId}/${posted.id}` });
        }
        catch (error) {
            if (posted?.id) {
                db_js_1.db.prepare("UPDATE polls SET status='cancelled',closed_at=? WHERE message_id=? AND status='active'").run(Date.now(), posted.id);
                await botApi(`/channels/${channelId}/messages/${posted.id}`, { method: 'DELETE' }).catch(() => { });
            }
            return jsonError(res, 502, error instanceof Error ? error.message : 'The poll could not be sent.');
        }
    });
    app.post('/api/guilds/:id/panels/send', auth, async (req, res) => {
        const guildId = String(req.params.id);
        if (!canManageGuild(req.user, guildId))
            return jsonError(res, 403, 'You cannot manage this server.');
        const type = String(req.body?.type || '').toLowerCase();
        const channelId = String(req.body?.channelId || '');
        if (!/^\d{17,20}$/.test(channelId))
            return jsonError(res, 400, 'Choose a valid text channel.');
        const channel = await botApi(`/channels/${channelId}`, { throwOnError: true }).catch(error => ({ __error: error.message }));
        if (channel?.__error)
            return jsonError(res, 502, channel.__error);
        if (!channel || String(channel.guild_id) !== guildId || ![0, 5].includes(Number(channel.type)))
            return jsonError(res, 400, 'The target must be a text or announcement channel in the selected server.');
        const cfg = (0, db_js_1.getGuildConfig)(guildId);
        let payload;
        try {
            if (type === 'ticket') {
                const panels = Array.isArray(cfg.ticketDefaults?.panels) ? cfg.ticketDefaults.panels : [];
                const requested = String(req.body?.panelId || 'default');
                const panel = panels.find(item => String(item.id) === requested || String(item.name || '').toLowerCase() === requested.toLowerCase());
                if (!panel)
                    return jsonError(res, 404, `Ticket panel “${requested}” was not found. Create or select it under Dashboard → Ticket Panels first.`);
                const { buildTicketPanelMessage } = await Promise.resolve().then(() => __importStar(require('./systems/tickets.js')));
                payload = restMessagePayload(buildTicketPanelMessage(guildId, panel.id));
                delete payload.content;
            }
            else if (type === 'application') {
                if (cfg.applicationDefaults?.enabled === false)
                    return jsonError(res, 400, 'Applications are disabled for this server. Enable the module in the dashboard first.');
                try {
                    payload = (0, applications_js_1.buildApplicationPanelRestPayload)(guildId, String(req.body?.panelId || 'default'));
                }
                catch (error) {
                    return jsonError(res, 400, error instanceof Error ? error.message : 'Could not build application panel.');
                }
            }
            else if (type === 'verification') {
                const roleId = String(cfg.verifyDefaults?.roleId || '');
                if (!/^[0-9]{17,20}$/.test(roleId))
                    return jsonError(res, 400, 'Set a verification role under Dashboard → Security before sending this panel.');
                const roleList = await botApi(`/guilds/${guildId}/roles`, { throwOnError: true }).catch(error => ({ __error: error.message }));
                if (roleList?.__error)
                    return jsonError(res, 502, roleList.__error);
                if (!Array.isArray(roleList) || !roleList.some(role => String(role.id) === roleId))
                    return jsonError(res, 400, 'The configured verification role no longer exists in this server.');
                payload = {
                    embeds: [{ title: String(cfg.verifyDefaults?.title || 'Verify your account').slice(0, 256), description: String(cfg.verifyDefaults?.message || 'Click the button below to receive the verified role.').slice(0, 4096), color: config_js_1.config.brand.success }],
                    components: [{ type: 1, components: [{ type: 2, style: 3, label: String(cfg.verifyDefaults?.buttonLabel || 'Verify').slice(0, 80), custom_id: 'verify' }] }],
                    allowed_mentions: { parse: [] }
                };
                cfg.verifyDefaults.enabled = true;
                cfg.verifyDefaults.channelId = channelId;
                (0, db_js_1.saveGuildConfig)(guildId, cfg);
            }
            else if (type === 'staffactivity') {
                payload = {
                    embeds: [{ title: 'Staff Activity Check', description: 'Staff members can use the button below to record their activity check.', color: config_js_1.config.brand.info }],
                    components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Check in', custom_id: 'staffactivity:check' }] }],
                    allowed_mentions: { parse: [] }
                };
            }
            else if (type === 'setup') {
                payload = {
                    embeds: [{ title: 'Auralis Setup', description: 'Configure modules, welcome messages, moderation, AutoMod, tickets and logs. Select a section below; changes are stored separately for this server.', color: config_js_1.config.brand.primary }],
                    components: (0, ui_js_1.setupMainComponents)().map(row => row.toJSON()),
                    allowed_mentions: { parse: [] }
                };
            }
            else {
                return jsonError(res, 400, 'Unsupported panel type. Choose ticket, application, verification, staffactivity, or setup.');
            }
        }
        catch (error) {
            return jsonError(res, 400, error instanceof Error ? error.message : 'Could not build this panel.');
        }
        const posted = await botApi(`/channels/${channelId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), throwOnError: true }).catch(error => ({ __error: error.message }));
        if (posted?.__error)
            return jsonError(res, 502, posted.__error);
        (0, db_js_1.auditDashboard)(req.user.id, 'panel.send', guildId, { type, channelId, messageId: posted.id });
        return res.json({ ok: true, type, messageId: posted.id, channelId, url: `https://discord.com/channels/${guildId}/${channelId}/${posted.id}` });
    });
    app.get('/api/guilds/:id/ticket-panels', auth, (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(req.params.id);
        res.json({ panels: cfg.ticketDefaults.panels || [], limits: panelLimits(cfg) });
    });
    app.post('/api/guilds/:id/ticket-panels', auth, (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        try {
            const cfg = (0, db_js_1.getGuildConfig)(req.params.id);
            const panels = Array.isArray(cfg.ticketDefaults.panels) ? structuredClone(cfg.ticketDefaults.panels) : [];
            const limits = panelLimits(cfg);
            if (panels.length >= limits.maxPanels)
                return jsonError(res, 400, `Maximum ${limits.maxPanels} ticket panels reached.`);
            const requested = normalizePanelForApi(req.body, `panel-${Date.now().toString(36)}`);
            if (panels.some(p => p.id === requested.id))
                return jsonError(res, 409, 'A panel with that ID already exists.');
            panels.push(requested);
            validatePanelCollection(cfg, panels);
            cfg.ticketDefaults.panels = panels;
            (0, db_js_1.saveGuildConfig)(req.params.id, cfg);
            res.json({ ok: true, panel: requested, panels });
        }
        catch (e) {
            return jsonError(res, 400, e instanceof Error ? e.message : 'Invalid panel.');
        }
    });
    app.patch('/api/guilds/:id/ticket-panels/:panelId', auth, (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        try {
            const cfg = (0, db_js_1.getGuildConfig)(req.params.id);
            const panels = Array.isArray(cfg.ticketDefaults.panels) ? structuredClone(cfg.ticketDefaults.panels) : [];
            const idx = panels.findIndex(p => String(p.id) === String(req.params.panelId));
            if (idx < 0)
                return jsonError(res, 404, 'Ticket panel not found.');
            const merged = { ...panels[idx], ...(req.body || {}), id: panels[idx].id };
            const updated = normalizePanelForApi(merged, panels[idx].id);
            panels[idx] = updated;
            validatePanelCollection(cfg, panels);
            cfg.ticketDefaults.panels = panels;
            (0, db_js_1.saveGuildConfig)(req.params.id, cfg);
            res.json({ ok: true, panel: updated, panels });
        }
        catch (e) {
            return jsonError(res, 400, e instanceof Error ? e.message : 'Invalid panel.');
        }
    });
    app.delete('/api/guilds/:id/ticket-panels/:panelId', auth, (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(req.params.id);
        const panels = Array.isArray(cfg.ticketDefaults.panels) ? structuredClone(cfg.ticketDefaults.panels) : [];
        const limits = panelLimits(cfg);
        if (panels.length <= limits.minPanels)
            return jsonError(res, 400, `At least ${limits.minPanels} ticket panel must remain.`);
        const next = panels.filter(p => String(p.id) !== String(req.params.panelId));
        if (next.length === panels.length)
            return jsonError(res, 404, 'Ticket panel not found.');
        cfg.ticketDefaults.panels = next;
        (0, db_js_1.saveGuildConfig)(req.params.id, cfg);
        res.json({ ok: true, panels: next });
    });
    app.post('/api/guilds/:id/ticket-panels/:panelId/send', auth, async (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(req.params.id);
        const panel = cfg.ticketDefaults.panels?.find(p => String(p.id) === String(req.params.panelId));
        if (!panel)
            return jsonError(res, 404, 'Ticket panel not found.');
        const channelId = String(req.body?.channelId || panel.channelId || '');
        if (!channelId)
            return jsonError(res, 400, 'Choose a channel.');
        const { buildTicketPanelMessage } = await Promise.resolve().then(() => __importStar(require('./systems/tickets.js')));
        let payload;
        try {
            payload = buildTicketPanelMessage(req.params.id, panel.id);
            delete payload.content;
            if (payload.components?.length === 0)
                payload.components = undefined;
        }
        catch (e) {
            return jsonError(res, 400, e instanceof Error ? e.message : 'Could not build panel.');
        }
        const message = await botApi(`/channels/${channelId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!message)
            return jsonError(res, 502, 'Discord rejected the panel message.');
        res.json({ ok: true, messageId: message.id, channelId });
    });
    function imageDataUrl(data) {
        const match = String(data ?? '').match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/i);
        if (!match)
            return null;
        return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2].replace(/\s+/g, ''), 'base64') };
    }
    app.get('/api/guilds/:id/welcome-assets', auth, (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const maxAge = 1000 * 60 * 60 * 24;
        const assets = (0, db_js_1.listWelcomeAssets)(req.params.id).map(asset => ({
            id: asset.asset_id,
            name: asset.name,
            mime: asset.mime,
            size: Number(asset.size),
            createdAt: asset.created_at,
            url: `/api/guilds/${req.params.id}/welcome-assets/${encodeURIComponent(asset.asset_id)}`,
            ageDays: Math.floor((Date.now() - asset.created_at) / maxAge)
        }));
        res.json({ assets, maxAssets: Number((0, db_js_1.getGuildConfig)(req.params.id).welcomeDefaults?.designer?.upload?.maxAssets ?? 50) });
    });
    app.post('/api/guilds/:id/welcome-assets', auth, async (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const cfg = (0, db_js_1.getGuildConfig)(req.params.id);
        const upload = cfg.welcomeDefaults?.designer?.upload || config_js_1.config.welcomeDefaults.designer.upload;
        const assets = (0, db_js_1.listWelcomeAssets)(req.params.id);
        if (assets.length >= Number(upload.maxAssets ?? 50))
            return jsonError(res, 400, `Maximum ${upload.maxAssets} welcome assets reached.`);
        const parsed = imageDataUrl(req.body?.data);
        if (!parsed)
            return jsonError(res, 400, 'Upload a PNG, JPEG, WebP or GIF image.');
        if (!upload.allowedMime?.includes(parsed.mime))
            return jsonError(res, 400, 'This image format is not allowed.');
        if (parsed.buffer.length > Number(upload.maxBytes ?? 6291456))
            return jsonError(res, 413, 'The image is too large.');
        const assetId = node_crypto_1.default.randomBytes(10).toString('hex');
        const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }[parsed.mime] || '.img';
        const guildId = String(req.params.id);
        if (!/^\d{1,25}$/.test(guildId))
            return jsonError(res, 400, 'Invalid server ID.');
        const folder = node_path_1.default.join(assetRoot, guildId, 'assets');
        node_fs_1.default.mkdirSync(folder, { recursive: true });
        const filePath = node_path_1.default.join(folder, `${assetId}${ext}`);
        await node_fs_1.default.promises.writeFile(filePath, parsed.buffer);
        const safeName = node_path_1.default.basename(String(req.body?.name ?? `welcome-${assetId}${ext}`)).slice(0, 120);
        const asset = (0, db_js_1.addWelcomeAsset)({ assetId, guildId: req.params.id, name: safeName, mime: parsed.mime, filePath, size: parsed.buffer.length });
        (0, db_js_1.auditDashboard)(req.user.id, 'welcome.asset.upload', req.params.id, { assetId, name: safeName, size: parsed.buffer.length });
        res.json({ ok: true, asset: { id: asset.asset_id, name: asset.name, mime: asset.mime, size: Number(asset.size), createdAt: asset.created_at, url: `/api/guilds/${req.params.id}/welcome-assets/${asset.asset_id}` } });
    });
    app.get('/api/guilds/:id/welcome-assets/:assetId', auth, async (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return res.status(403).end();
        const asset = (0, db_js_1.getWelcomeAsset)(req.params.assetId, req.params.id);
        if (!asset)
            return res.status(404).end();
        const file = node_path_1.default.resolve(asset.file_path);
        if (!file.startsWith(assetRoot + node_path_1.default.sep) || !node_fs_1.default.existsSync(file))
            return res.status(404).end();
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.type(asset.mime);
        return res.sendFile(file);
    });
    app.delete('/api/guilds/:id/welcome-assets/:assetId', auth, async (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        const asset = (0, db_js_1.getWelcomeAsset)(req.params.assetId, req.params.id);
        if (!asset)
            return jsonError(res, 404, 'Welcome asset not found.');
        const removed = (0, db_js_1.deleteWelcomeAsset)(req.params.assetId, req.params.id);
        if (removed)
            await node_fs_1.default.promises.unlink(asset.file_path).catch(() => { });
        (0, db_js_1.auditDashboard)(req.user.id, 'welcome.asset.delete', req.params.id, { assetId: req.params.assetId });
        res.json({ ok: removed });
    });
    app.get('/api/guilds/:id/invite', auth, (req, res) => {
        if (!canManageGuild(req.user, req.params.id))
            return jsonError(res, 403, 'You cannot manage this server.');
        res.json({ url: config_js_1.config.discord.installUrl || (0, ui_js_1.inviteUrl)(process.env.DISCORD_CLIENT_ID ?? '', discord_js_1.PermissionsBitField.resolve(config_js_1.config.discord.requiredBotPermissions)) });
    });
    app.get('/api/admin/overview', auth, (req, res) => {
        if (!canViewAllGuilds(req.user))
            return jsonError(res, 403, 'You cannot view global Auralis metrics.');
        const scalar = sql => Number(db_js_1.db.prepare(sql).get()?.count || 0);
        const guilds = scalar('SELECT COUNT(*) AS count FROM bot_guild_index');
        const memberCount = Number(db_js_1.db.prepare('SELECT COALESCE(SUM(member_count),0) AS count FROM bot_guild_index').get()?.count || 0);
        const openTickets = scalar("SELECT COUNT(*) AS count FROM tickets WHERE status='open'");
        const pendingApplications = scalar("SELECT COUNT(*) AS count FROM applications WHERE status IN ('pending','reviewing')");
        const reviewingApplications = scalar("SELECT COUNT(*) AS count FROM applications WHERE status='reviewing'");
        const acceptedApplications = scalar("SELECT COUNT(*) AS count FROM applications WHERE status='accepted'");
        const rejectedApplications = scalar("SELECT COUNT(*) AS count FROM applications WHERE status='rejected'");
        const totalApplications = scalar('SELECT COUNT(*) AS count FROM applications');
        db_js_1.db.prepare('DELETE FROM application_drafts WHERE expires_at<=?').run(Date.now());
        const activeApplicationDrafts = scalar('SELECT COUNT(*) AS count FROM application_drafts WHERE expires_at>?');
        const cases = scalar('SELECT COUNT(*) AS count FROM cases');
        const activeWarnings = scalar('SELECT COUNT(*) AS count FROM warnings WHERE active=1');
        const closedTickets = scalar("SELECT COUNT(*) AS count FROM tickets WHERE status<>'open'");
        const health = (0, bot_health_js_1.getBotHealthSnapshot)();
        const formatUptime = seconds => {
            if (!Number.isFinite(Number(seconds)) || Number(seconds) < 0)
                return 'Offline';
            seconds = Math.floor(Number(seconds));
            const days = Math.floor(seconds / 86400);
            seconds %= 86400;
            const hours = Math.floor(seconds / 3600);
            seconds %= 3600;
            const minutes = Math.floor(seconds / 60);
            return `${days ? `${days}d ` : ''}${hours}h ${minutes}m`;
        };
        res.set('Cache-Control', 'no-store');
        res.json({ ok: true, guilds, memberCount, openTickets, closedTickets, pendingApplications, reviewingApplications, acceptedApplications, rejectedApplications, totalApplications, activeApplicationDrafts, cases, activeWarnings, uptimeSeconds: health.uptimeSeconds, uptimeLabel: formatUptime(health.uptimeSeconds), botReady: health.online, botStatus: health.status, botHealth: health });
    });
    app.get('/api/admin/access', auth, (req, res) => {
        const access = globalAccess(req.user.id);
        if (access.level === 'none')
            return jsonError(res, 403, 'Auralis administrator access is required.');
        res.json({ access });
    });
    app.get('/api/admin/runtime', auth, (req, res) => {
        if (!hasGlobalPermission(req.user, 'manage_bot_status'))
            return jsonError(res, 403, 'You cannot manage bot status.');
        res.json({ presence: (0, db_js_1.getRuntime)('presence', { status: 'online', type: 'WATCHING', text: 'Support & Moderation' }) });
    });
    app.patch('/api/admin/runtime', auth, (req, res) => {
        if (!hasGlobalPermission(req.user, 'manage_bot_status'))
            return jsonError(res, 403, 'You cannot manage bot status.');
        const body = req.body ?? {};
        const presence = {
            status: ['online', 'idle', 'dnd', 'invisible'].includes(String(body.status).toLowerCase()) ? String(body.status).toLowerCase() : 'online',
            type: ['PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'COMPETING'].includes(String(body.type).toUpperCase()) ? String(body.type).toUpperCase() : 'WATCHING',
            text: String(body.text ?? '').trim().slice(0, 128)
        };
        (0, db_js_1.setRuntime)('presence', presence);
        (0, db_js_1.auditDashboard)(req.user.id, 'presence.update', null, presence);
        res.json({ ok: true, presence });
    });
    app.get('/api/admin/staff', auth, (req, res) => {
        if (!hasGlobalPermission(req.user, 'manage_staff'))
            return jsonError(res, 403, 'You cannot manage Auralis staff.');
        const owners = Object.entries(config_js_1.config.dashboardAccess.owners ?? {}).map(([userId, owner]) => ({ userId, label: owner.name ?? '', username: owner.username ?? '', permissions: ['*'], owner: true }));
        res.json({ owners, staff: (0, db_js_1.listDashboardStaff)(), permissions: config_js_1.config.dashboardAccess.staffPermissions });
    });
    app.post('/api/admin/staff', auth, (req, res) => {
        if (!config_js_1.config.dashboardAccess.owners?.[String(req.user.id)])
            return jsonError(res, 403, 'Only the configured Auralis owner can add or change global staff access.');
        const userId = String(req.body?.userId ?? '').trim();
        if (!/^\d{15,25}$/.test(userId))
            return jsonError(res, 400, 'Enter a valid Discord user ID.');
        if (config_js_1.config.dashboardAccess.owners?.[userId])
            return jsonError(res, 400, 'That user is a configured owner.');
        const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions.filter(p => config_js_1.config.dashboardAccess.staffPermissions.includes(p)) : [];
        const staff = (0, db_js_1.upsertDashboardStaff)(userId, String(req.body?.label ?? '').trim().slice(0, 80), permissions, req.user.id);
        (0, db_js_1.auditDashboard)(req.user.id, 'staff.upsert', userId, { permissions });
        res.json({ ok: true, staff });
    });
    app.delete('/api/admin/staff/:userId', auth, (req, res) => {
        if (!config_js_1.config.dashboardAccess.owners?.[String(req.user.id)])
            return jsonError(res, 403, 'Only the configured Auralis owner can remove global staff access.');
        const userId = String(req.params.userId);
        if (config_js_1.config.dashboardAccess.owners?.[userId])
            return jsonError(res, 400, 'Owners cannot be removed here.');
        const removed = (0, db_js_1.deleteDashboardStaff)(userId);
        (0, db_js_1.auditDashboard)(req.user.id, 'staff.remove', userId);
        res.json({ ok: removed });
    });
    app.get('/api/admin/guilds', auth, async (req, res) => {
        if (!canViewAllGuilds(req.user))
            return jsonError(res, 403, 'You cannot view all Auralis servers.');
        const list = await botGuilds();
        const blacklisted = new Map((0, db_js_1.listDashboardBlacklist)().map(row => [row.guild_id, row]));
        const details = [];
        const concurrency = 8;
        let index = 0;
        const worker = async () => {
            while (index < list.length) {
                const current = list[index++];
                const full = await botApi(`/guilds/${current.id}?with_counts=true`);
                const row = full ?? current;
                const black = blacklisted.get(current.id);
                details.push({
                    id: current.id,
                    name: row.name ?? current.name,
                    icon: row.icon ? `https://cdn.discordapp.com/icons/${current.id}/${row.icon}.png?size=128` : null,
                    description: row.description ?? null,
                    members: Number(row.approximate_member_count ?? row.member_count ?? 0),
                    ownerId: row.owner_id ?? null,
                    features: row.features ?? [],
                    invite: (0, db_js_1.getGuildConfig)(current.id).publicDirectory?.invite || (row.vanity_url_code ? `https://discord.gg/${row.vanity_url_code}` : null),
                    blacklisted: Boolean(black),
                    blacklistReason: black?.reason ?? null,
                    botInstalled: true
                });
            }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
        details.sort((a, b) => a.name.localeCompare(b.name));
        res.json({ guilds: details, count: details.length, blacklisted: [...blacklisted.values()] });
    });
    app.post('/api/admin/guilds/:id/invite', auth, async (req, res) => {
        if (!canViewAllGuilds(req.user))
            return jsonError(res, 403, 'You cannot request a server invite.');
        const guildId = String(req.params.id);
        if (!(0, db_js_1.listBotGuildIndex)().some(guild => String(guild.id) === guildId))
            return jsonError(res, 404, 'Auralis is not currently connected to that server.');
        if ((0, db_js_1.isGuildBlacklisted)(guildId))
            return jsonError(res, 400, 'Remove the server from the blacklist before creating an invite.');
        const guildSettings = (0, db_js_1.getGuildConfig)(guildId);
        const previousCode = String(guildSettings.dashboardManagedInviteCode || '').trim();
        const channelResponse = await botApi(`/guilds/${guildId}/channels`, { throwOnError: true }).catch(error => ({ __error: error.message }));
        if (channelResponse?.__error)
            return jsonError(res, 502, channelResponse.__error);
        const channels = Array.isArray(channelResponse) ? channelResponse.filter(channel => [0, 5].includes(Number(channel.type)) && channel.permissions_for?.includes?.('CreateInstantInvite') !== false) : [];
        let lastError = 'Auralis could not create an invite. Make sure it has Create Instant Invite permission in at least one text channel.';
        for (const channel of channels) {
            const created = await botApi(`/channels/${channel.id}/invites`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ max_age: 86400, max_uses: 1, temporary: false, unique: true }), throwOnError: true
            }).catch(error => ({ __error: error.message }));
            if (created?.code) {
                const url = `https://discord.gg/${created.code}`;
                if (previousCode && previousCode !== created.code) {
                    await botApi(`/invites/${encodeURIComponent(previousCode)}`, { method: 'DELETE', throwOnError: true }).catch(() => null);
                }
                guildSettings.dashboardManagedInviteCode = created.code;
                (0, db_js_1.saveGuildConfig)(guildId, guildSettings);
                (0, db_js_1.auditDashboard)(req.user.id, 'guild.invite.create', guildId, { channelId: channel.id, maxAgeSeconds: 86400, maxUses: 1, replacedPreviousDashboardInvite: Boolean(previousCode) });
                return res.json({ ok: true, url, channelId: channel.id, expiresAt: Date.now() + 86400000, maxUses: 1 });
            }
            if (created?.__error)
                lastError = created.__error;
        }
        return jsonError(res, 502, lastError);
    });
    app.post('/api/admin/guilds/:id/leave', auth, async (req, res) => {
        if (!hasGlobalPermission(req.user, 'leave_guilds'))
            return jsonError(res, 403, 'You cannot make Auralis leave servers.');
        const id = req.params.id;
        if ((0, db_js_1.isGuildBlacklisted)(id))
            return jsonError(res, 400, 'This server is blacklisted. Remove the blacklist before using leave.');
        if (!process.env.DISCORD_TOKEN)
            return jsonError(res, 503, 'The bot token is not configured.');
        try {
            const response = await fetch(`https://discord.com/api/v10/users/@me/guilds/${id}`, { method: 'DELETE', headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } });
            if (!response.ok)
                return jsonError(res, response.status, 'Discord rejected the leave request.');
            (0, db_js_1.auditDashboard)(req.user.id, 'guild.leave', id);
            res.json({ ok: true });
        }
        catch (error) {
            return jsonError(res, 502, error instanceof Error ? error.message : 'Leave failed.');
        }
    });
    app.post('/api/admin/guilds/:id/blacklist', auth, async (req, res) => {
        if (!hasGlobalPermission(req.user, 'blacklist_guilds'))
            return jsonError(res, 403, 'You cannot manage the Auralis blacklist.');
        const id = req.params.id;
        const reason = String(req.body?.reason ?? 'Blacklisted by Auralis staff.').trim().slice(0, 500);
        (0, db_js_1.setGuildBlacklist)(id, reason, req.user.id);
        (0, db_js_1.auditDashboard)(req.user.id, 'guild.blacklist', id, { reason });
        if (process.env.DISCORD_TOKEN)
            await fetch(`https://discord.com/api/v10/users/@me/guilds/${id}`, { method: 'DELETE', headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }).catch(() => { });
        res.json({ ok: true });
    });
    app.delete('/api/admin/guilds/:id/blacklist', auth, (req, res) => {
        if (!hasGlobalPermission(req.user, 'blacklist_guilds'))
            return jsonError(res, 403, 'You cannot manage the Auralis blacklist.');
        const removed = (0, db_js_1.removeGuildBlacklist)(req.params.id);
        (0, db_js_1.auditDashboard)(req.user.id, 'guild.blacklist.remove', req.params.id);
        res.json({ ok: removed });
    });
    app.get('/api/admin/blacklist', auth, (req, res) => {
        if (!hasGlobalPermission(req.user, 'blacklist_guilds'))
            return jsonError(res, 403, 'You cannot view the Auralis blacklist.');
        res.json({ entries: (0, db_js_1.listDashboardBlacklist)() });
    });
    app.get('/api/admin/audit', auth, (req, res) => {
        if (!hasGlobalPermission(req.user, 'view_analytics'))
            return jsonError(res, 403, 'You cannot view Auralis admin audit logs.');
        res.json({ entries: (0, db_js_1.recentDashboardAudit)(Number(req.query.limit) || 100) });
    });
    app.use(express_1.default.static(staticRoot));
    app.use((req, res) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/public/api/'))
            return res.status(404).end();
        const index = node_path_1.default.join(staticRoot, 'index.html');
        if (node_fs_1.default.existsSync(index))
            return res.sendFile(index);
        return res.status(404).send('Auralis website is missing.');
    });
    const port = Number(process.env.PORT || config_js_1.config.dashboard.port);
    const bindHost = process.env.HOST || '0.0.0.0';
    app.listen(port, bindHost, () => {
        const configuredPublicUrl = String(process.env.DASHBOARD_PUBLIC_URL ?? '').trim();
        const url = configuredPublicUrl || `http://localhost:${port}`;
        console.log(`${config_js_1.config.logging.consolePrefix} Dashboard & website listening on ${url} (bind ${bindHost}:${port})`);
        console.log(`${config_js_1.config.logging.consolePrefix} OAuth redirect URI: ${oauthRedirectUri()}`);
        const hasDesktopSession = process.platform === 'win32'
            || process.platform === 'darwin'
            || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
        const shouldOpenBrowser = process.env.DASHBOARD_OPEN === 'true'
            && process.env.NODE_ENV !== 'production'
            && hasDesktopSession;
        if (shouldOpenBrowser) {
            const command = process.platform === 'win32'
                ? ['cmd', ['/c', 'start', '', url]]
                : process.platform === 'darwin'
                    ? ['open', [url]]
                    : ['xdg-open', [url]];
            const browser = (0, node_child_process_1.spawn)(command[0], command[1], { detached: true, stdio: 'ignore', shell: false });
            browser.on('error', error => {
                console.warn(`${config_js_1.config.logging.consolePrefix} Could not open a local browser (${error.message}); the dashboard server will keep running.`);
            });
            browser.unref();
        }
    });
}).catch(error => {
    console.error(`[Auralis] Dashboard initialization failed: ${error?.message || error}`);
    process.exit(1);
});

});
__factories.set("src/db.js", function(exports, require, module, __filename, __dirname) {
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.ensureGuildDataDirectory = ensureGuildDataDirectory;
exports.upsertBotGuildIndex = upsertBotGuildIndex;
exports.removeBotGuildIndex = removeBotGuildIndex;
exports.syncBotGuildIndex = syncBotGuildIndex;
exports.listBotGuildIndex = listBotGuildIndex;
exports.getGuildConfig = getGuildConfig;
exports.saveGuildConfig = saveGuildConfig;
exports.updateGuildConfig = updateGuildConfig;
exports.prefixCommandEnabled = prefixCommandEnabled;
exports.setPrefixCommand = setPrefixCommand;
exports.mergeDeep = mergeDeep;
exports.getDashboardStaff = getDashboardStaff;
exports.listDashboardStaff = listDashboardStaff;
exports.upsertDashboardStaff = upsertDashboardStaff;
exports.deleteDashboardStaff = deleteDashboardStaff;
exports.listDashboardBlacklist = listDashboardBlacklist;
exports.isGuildBlacklisted = isGuildBlacklisted;
exports.setGuildBlacklist = setGuildBlacklist;
exports.removeGuildBlacklist = removeGuildBlacklist;
exports.getManagedInvite = getManagedInvite;
exports.setManagedInvite = setManagedInvite;
exports.removeManagedInvite = removeManagedInvite;
exports.listManagedInvites = listManagedInvites;
exports.addWelcomeAsset = addWelcomeAsset;
exports.listWelcomeAssets = listWelcomeAssets;
exports.getWelcomeAsset = getWelcomeAsset;
exports.deleteWelcomeAsset = deleteWelcomeAsset;
exports.getRuntime = getRuntime;
exports.setRuntime = setRuntime;
exports.auditDashboard = auditDashboard;
exports.recentDashboardAudit = recentDashboardAudit;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const config_js_1 = require("./config.js");
const dataDir = node_path_1.default.resolve(process.env.AURALIS_DATA_DIR || node_path_1.default.dirname(config_js_1.config.database.file));
node_fs_1.default.mkdirSync(dataDir, { recursive: true });
const databaseFile = node_path_1.default.resolve(process.env.AURALIS_DATABASE_FILE || node_path_1.default.join(dataDir, 'auralis.sqlite'));
const db = new better_sqlite3_1.default(databaseFile);
exports.db = db;
function ensureGuildDataDirectory(guildId) {
    const id = String(guildId ?? '').trim();
    if (!/^\d{1,25}$/.test(id))
        return null;
    const directory = node_path_1.default.join(dataDir, id);
    node_fs_1.default.mkdirSync(node_path_1.default.join(directory, 'assets'), { recursive: true });
    return directory;
}
function persistGuildSettings(guildId, data) {
    const directory = ensureGuildDataDirectory(guildId);
    if (!directory)
        return;
    const target = node_path_1.default.join(directory, 'settings.json');
    const temporary = `${target}.${process.pid}.tmp`;
    node_fs_1.default.writeFileSync(temporary, `${JSON.stringify({ guildId: String(guildId), updatedAt: Date.now(), settings: data }, null, 2)}\n`);
    node_fs_1.default.renameSync(temporary, target);
}
db.pragma(`busy_timeout = ${config_js_1.config.database.busyTimeout}`);
db.pragma(`journal_mode = ${config_js_1.config.database.journalMode}`);
db.pragma(`cache_size = ${config_js_1.config.database.cacheSizeKb}`);
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
 guild_id TEXT PRIMARY KEY,
 data TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bot_guild_index (
 guild_id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 icon TEXT,
 description TEXT,
 member_count INTEGER NOT NULL DEFAULT 0,
 owner_id TEXT,
 features_json TEXT NOT NULL DEFAULT '[]',
 vanity_url_code TEXT,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bot_guild_index_name ON bot_guild_index(name);
CREATE TABLE IF NOT EXISTS cases (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 moderator_id TEXT NOT NULL,
 type TEXT NOT NULL,
 reason TEXT,
 duration_ms INTEGER,
 created_at INTEGER NOT NULL,
 expires_at INTEGER,
 active INTEGER NOT NULL DEFAULT 1,
 metadata TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_cases_guild_user ON cases(guild_id, user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS warnings (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 moderator_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS applications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 type TEXT NOT NULL,
 answers TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'pending',
 reviewer_id TEXT,
 review_reason TEXT,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_applications_guild_status ON applications(guild_id,status,created_at DESC);
-- Approximate live application-modal drafts. Discord does not emit a close/cancel
-- event for modals, so these rows expire automatically after a short TTL.
CREATE TABLE IF NOT EXISTS application_drafts (
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 type TEXT NOT NULL,
 opened_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 PRIMARY KEY(guild_id,user_id,type)
);
CREATE INDEX IF NOT EXISTS idx_application_drafts_expiry ON application_drafts(guild_id,expires_at);
CREATE TABLE IF NOT EXISTS tickets (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guild_id TEXT NOT NULL,
 channel_id TEXT UNIQUE,
 opener_id TEXT NOT NULL,
 type TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open',
 created_at INTEGER NOT NULL,
 closed_at INTEGER,
 closed_by TEXT,
 data TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_tickets_guild_status ON tickets(guild_id, status, created_at DESC);
CREATE TABLE IF NOT EXISTS ticket_stats (
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 closes INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS custom_commands (
 guild_id TEXT NOT NULL,
 name TEXT NOT NULL,
 reply TEXT NOT NULL,
 created_by TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(guild_id, name)
);
CREATE TABLE IF NOT EXISTS tags (
 guild_id TEXT NOT NULL,
 name TEXT NOT NULL,
 content TEXT NOT NULL,
 author_id TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(guild_id, name)
);
CREATE TABLE IF NOT EXISTS reaction_roles (
 guild_id TEXT NOT NULL,
 message_id TEXT NOT NULL,
 emoji TEXT NOT NULL,
 role_id TEXT NOT NULL,
 channel_id TEXT NOT NULL,
 PRIMARY KEY(guild_id, message_id, emoji)
);
CREATE TABLE IF NOT EXISTS button_roles (
 guild_id TEXT NOT NULL,
 message_id TEXT NOT NULL,
 component_index INTEGER NOT NULL,
 role_id TEXT NOT NULL,
 style TEXT NOT NULL,
 emoji TEXT,
 label TEXT,
 PRIMARY KEY(guild_id, message_id, component_index)
);
CREATE TABLE IF NOT EXISTS sticky (
 guild_id TEXT NOT NULL,
 channel_id TEXT PRIMARY KEY,
 message_id TEXT,
 content TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS giveaways (
 message_id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL,
 channel_id TEXT NOT NULL,
 prize TEXT NOT NULL,
 description TEXT,
 winners INTEGER NOT NULL,
 end_at INTEGER NOT NULL,
 host_id TEXT NOT NULL,
 color INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'active',
 constraints TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS giveaway_entries (
 message_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(message_id, user_id)
);
CREATE TABLE IF NOT EXISTS levels (
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 xp INTEGER NOT NULL DEFAULT 0,
 level INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS level_rewards (
 guild_id TEXT NOT NULL,
 level INTEGER NOT NULL,
 role_id TEXT NOT NULL,
 PRIMARY KEY(guild_id, level)
);
CREATE TABLE IF NOT EXISTS autoroles (
 guild_id TEXT NOT NULL,
 role_id TEXT NOT NULL,
 PRIMARY KEY(guild_id, role_id)
);
CREATE TABLE IF NOT EXISTS jailed_roles (
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 roles TEXT NOT NULL,
 jailed_at INTEGER NOT NULL,
 PRIMARY KEY(guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS reminders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL,
 guild_id TEXT,
 channel_id TEXT,
 fire_at INTEGER NOT NULL,
 message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS birthdays (
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 month INTEGER NOT NULL,
 day INTEGER NOT NULL,
 PRIMARY KEY(guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS timezones (
 user_id TEXT PRIMARY KEY,
 timezone TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS suggestions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 text TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 message_id TEXT,
 created_at INTEGER NOT NULL,
 reason TEXT
);
CREATE TABLE IF NOT EXISTS counters (
 guild_id TEXT NOT NULL,
 channel_id TEXT PRIMARY KEY,
 metric TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS image_only (
 guild_id TEXT NOT NULL,
 channel_id TEXT PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS image_only_violations (
 guild_id TEXT NOT NULL,
 channel_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 count INTEGER NOT NULL DEFAULT 0,
 window_start INTEGER NOT NULL DEFAULT 0,
 last_timeout_at INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(guild_id, channel_id, user_id)
);
CREATE TABLE IF NOT EXISTS honeypot_hits (
 guild_id TEXT NOT NULL,
 channel_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 count INTEGER NOT NULL DEFAULT 0,
 window_start INTEGER NOT NULL DEFAULT 0,
 last_timeout_at INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(guild_id, channel_id, user_id)
);
CREATE TABLE IF NOT EXISTS sessions (
 token TEXT PRIMARY KEY,
 user_json TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS prefix_commands (
 guild_id TEXT NOT NULL,
 command_name TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(guild_id, command_name)
);
CREATE TABLE IF NOT EXISTS voice_channels (
 guild_id TEXT NOT NULL,
 channel_id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 settings TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS economy_accounts (
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 wallet INTEGER NOT NULL DEFAULT 0,
 bank INTEGER NOT NULL DEFAULT 0,
 bank_cap INTEGER NOT NULL DEFAULT 1000,
 daily_streak INTEGER NOT NULL DEFAULT 0,
 daily_at INTEGER NOT NULL DEFAULT 0,
 work_at INTEGER NOT NULL DEFAULT 0,
 rob_immunity_until INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(guild_id,user_id)
);
CREATE TABLE IF NOT EXISTS booster_roles (
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 role_id TEXT NOT NULL,
 PRIMARY KEY(guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS dashboard_staff (
 user_id TEXT PRIMARY KEY,
 label TEXT,
 permissions TEXT NOT NULL DEFAULT '[]',
 added_by TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dashboard_blacklist (
 guild_id TEXT PRIMARY KEY,
 reason TEXT,
 added_by TEXT,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bot_runtime (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS managed_invites (
 guild_id TEXT PRIMARY KEY,
 channel_id TEXT NOT NULL,
 code TEXT NOT NULL,
 url TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS welcome_assets (
 asset_id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL,
 name TEXT NOT NULL,
 mime TEXT NOT NULL,
 file_path TEXT NOT NULL,
 size INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_welcome_assets_guild ON welcome_assets(guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_managed_invites_code ON managed_invites(code);
CREATE TABLE IF NOT EXISTS dashboard_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_id TEXT NOT NULL,
 action TEXT NOT NULL,
 target_id TEXT,
 metadata TEXT NOT NULL DEFAULT '{}',
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dashboard_audit_created ON dashboard_audit(created_at DESC);
CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS staff_activity (
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 message_count INTEGER NOT NULL DEFAULT 0,
 command_count INTEGER NOT NULL DEFAULT 0,
 ticket_closes INTEGER NOT NULL DEFAULT 0,
 moderation_actions INTEGER NOT NULL DEFAULT 0,
 last_active_at INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(guild_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_activity_guild ON staff_activity(guild_id, last_active_at DESC);
CREATE TABLE IF NOT EXISTS staff_activity_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 detail TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_staff_activity_events_guild_time ON staff_activity_events(guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_activity_events_user_time ON staff_activity_events(guild_id, user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS staff_activity_checks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guild_id TEXT NOT NULL,
 channel_id TEXT NOT NULL,
 message_id TEXT,
 sent_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 closed_at INTEGER,
 status TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS idx_staff_activity_checks_guild ON staff_activity_checks(guild_id, sent_at DESC);
CREATE TABLE IF NOT EXISTS staff_activity_responses (
 check_id INTEGER NOT NULL,
 guild_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 responded_at INTEGER NOT NULL,
 PRIMARY KEY(check_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_activity_responses_check ON staff_activity_responses(check_id, responded_at DESC);
`);
function tableColumns(table) {
    return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
}
function ensureColumn(table, column, definition) {
    const columns = tableColumns(table);
    if (!columns.has(column))
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('giveaways', 'description', "TEXT");
ensureColumn('giveaways', 'winners', "INTEGER NOT NULL DEFAULT 1");
ensureColumn('giveaways', 'end_at', "INTEGER NOT NULL DEFAULT 0");
ensureColumn('giveaways', 'host_id', "TEXT NOT NULL DEFAULT ''");
ensureColumn('giveaways', 'color', "INTEGER NOT NULL DEFAULT 8381");
ensureColumn('giveaways', 'status', "TEXT NOT NULL DEFAULT 'active'");
ensureColumn('giveaways', 'constraints', "TEXT NOT NULL DEFAULT '{}'");
if (tableColumns('giveaways').has('active')) {
    db.exec("UPDATE giveaways SET status=CASE WHEN active=1 THEN 'active' ELSE 'ended' END WHERE status='active'");
}
db.prepare("INSERT INTO schema_meta(key,value) VALUES('version','2026-10-08-staff-activity-v2') ON CONFLICT(key) DO UPDATE SET value=excluded.value").run();
ensureColumn('cases', 'metadata', "TEXT DEFAULT '{}'");
ensureColumn('tickets', 'data', "TEXT DEFAULT '{}'");
ensureColumn('custom_commands', 'enabled', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('custom_commands', 'response_mode', "TEXT NOT NULL DEFAULT 'channel'");
ensureColumn('custom_commands', 'reply_mode', "TEXT NOT NULL DEFAULT 'reply'");
ensureColumn('custom_commands', 'delete_invocation', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('custom_commands', 'cooldown_seconds', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('custom_commands', 'allowed_role_ids', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('custom_commands', 'required_permission', "TEXT NOT NULL DEFAULT 'None'");
ensureColumn('custom_commands', 'embed_json', "TEXT NOT NULL DEFAULT '{}'");
const getGuild = db.prepare('SELECT data FROM guild_settings WHERE guild_id = ?');
const upsertGuild = db.prepare('INSERT INTO guild_settings(guild_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(guild_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at');
const getPrefix = db.prepare('SELECT enabled FROM prefix_commands WHERE guild_id = ? AND command_name = ?');
const upsertBotGuildRow = db.prepare(`INSERT INTO bot_guild_index
 (guild_id,name,icon,description,member_count,owner_id,features_json,vanity_url_code,updated_at)
 VALUES(?,?,?,?,?,?,?,?,?)
 ON CONFLICT(guild_id) DO UPDATE SET name=excluded.name,icon=excluded.icon,description=excluded.description,
 member_count=excluded.member_count,owner_id=excluded.owner_id,features_json=excluded.features_json,
 vanity_url_code=excluded.vanity_url_code,updated_at=excluded.updated_at`);
function botGuildValues(guild) {
    return [String(guild.id), String(guild.name || 'Unknown server'), guild.icon ?? null,
        typeof guild.description === 'string' ? guild.description : null,
        Math.max(0, Number(guild.memberCount ?? guild.approximate_member_count ?? guild.member_count ?? 0) || 0),
        guild.ownerId ?? guild.owner_id ?? null,
        JSON.stringify(Array.isArray(guild.features) ? guild.features : []),
        guild.vanityURLCode ?? guild.vanity_url_code ?? null, Date.now()];
}
function upsertBotGuildIndex(guild) {
    if (!guild?.id)
        return;
    upsertBotGuildRow.run(...botGuildValues(guild));
}
function removeBotGuildIndex(guildId) {
    return db.prepare('DELETE FROM bot_guild_index WHERE guild_id=?').run(String(guildId)).changes > 0;
}
function syncBotGuildIndex(guilds) {
    const rows = [...guilds].filter(guild => guild?.id);
    const sync = db.transaction(() => {
        db.prepare('DELETE FROM bot_guild_index').run();
        for (const guild of rows)
            upsertBotGuildRow.run(...botGuildValues(guild));
    });
    sync();
    return rows.length;
}
function listBotGuildIndex() {
    return db.prepare('SELECT * FROM bot_guild_index ORDER BY name COLLATE NOCASE, guild_id').all().map(row => {
        let features = [];
        try {
            features = JSON.parse(row.features_json);
        }
        catch {
            features = [];
        }
        return {
            id: row.guild_id, name: row.name, icon: row.icon, description: row.description,
            member_count: Number(row.member_count || 0), approximate_member_count: Number(row.member_count || 0),
            owner_id: row.owner_id, features, vanity_url_code: row.vanity_url_code, updated_at: row.updated_at
        };
    });
}
function getGuildConfig(guildId) {
    const defaults = (0, config_js_1.cloneDefaults)();
    delete defaults.dashboardAccess;
    delete defaults.dashboardSecurity;
    ensureGuildDataDirectory(guildId);
    const row = getGuild.get(guildId);
    if (!row) {
        upsertGuild.run(guildId, JSON.stringify(defaults), Date.now());
        persistGuildSettings(guildId, defaults);
        return defaults;
    }
    try {
        const stored = JSON.parse(row.data);
        const data = mergeDeep(defaults, stored);
        const legacyReasonDefault = ['WARN', 'BAN', 'TEMPBAN', 'KICK', 'TIMEOUT', 'JAIL'];
        const storedRequiredReasons = data.moderation?.reasonRequiredFor;
        if (Array.isArray(storedRequiredReasons)
            && storedRequiredReasons.length === legacyReasonDefault.length
            && legacyReasonDefault.every(action => storedRequiredReasons.includes(action))) {
            data.moderation.reasonRequiredFor = [];
        }
        if (!data.publicDirectory)
            data.publicDirectory = structuredClone(config_js_1.config.publicDirectoryDefaults);
        if (!data.modules)
            data.modules = structuredClone(config_js_1.config.modules);
        if (!data.ticketDefaults)
            data.ticketDefaults = structuredClone(config_js_1.config.ticketDefaults);
        if (!Array.isArray(data.ticketDefaults.panels) || data.ticketDefaults.panels.length === 0)
            data.ticketDefaults.panels = structuredClone(config_js_1.config.ticketDefaults.panels);
        if (!data.ticketDefaults.panelLimits)
            data.ticketDefaults.panelLimits = structuredClone(config_js_1.config.ticketDefaults.panelLimits);
        data.ticketDefaults.panelLimits.maxPanels = Math.max(500, Number(data.ticketDefaults.panelLimits.maxPanels || 0));
        const directory = ensureGuildDataDirectory(guildId);
        if (directory && !node_fs_1.default.existsSync(node_path_1.default.join(directory, 'settings.json')))
            persistGuildSettings(guildId, data);
        return data;
    }
    catch {
        return defaults;
    }
}
function saveGuildConfig(guildId, data) {
    upsertGuild.run(guildId, JSON.stringify(data), Date.now());
    persistGuildSettings(guildId, data);
    return data;
}
function updateGuildConfig(guildId, updater) {
    const next = updater(getGuildConfig(guildId));
    return saveGuildConfig(guildId, next);
}
function prefixCommandEnabled(guildId, commandName) {
    const row = getPrefix.get(guildId, commandName);
    return row ? Boolean(row.enabled) : true;
}
function setPrefixCommand(guildId, commandName, enabled) {
    db.prepare('INSERT INTO prefix_commands(guild_id,command_name,enabled) VALUES(?,?,?) ON CONFLICT(guild_id,command_name) DO UPDATE SET enabled=excluded.enabled').run(guildId, commandName, enabled ? 1 : 0);
}
function mergeDeep(target, source) {
    for (const [key, value] of Object.entries(source ?? {})) {
        if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
            mergeDeep(target[key], value);
        }
        else {
            target[key] = value;
        }
    }
    return target;
}
function getDashboardStaff(userId) {
    const row = db.prepare('SELECT * FROM dashboard_staff WHERE user_id=?').get(String(userId));
    if (!row)
        return null;
    let permissions = [];
    try {
        permissions = JSON.parse(row.permissions);
    }
    catch {
        permissions = [];
    }
    return { userId: row.user_id, label: row.label ?? '', permissions, addedBy: row.added_by ?? null, createdAt: row.created_at, updatedAt: row.updated_at };
}
function listDashboardStaff() {
    return db.prepare('SELECT * FROM dashboard_staff ORDER BY created_at ASC').all().map(row => {
        let permissions = [];
        try {
            permissions = JSON.parse(row.permissions);
        }
        catch {
            permissions = [];
        }
        return { userId: row.user_id, label: row.label ?? '', permissions, addedBy: row.added_by ?? null, createdAt: row.created_at, updatedAt: row.updated_at };
    });
}
function upsertDashboardStaff(userId, label, permissions, addedBy) {
    const now = Date.now();
    db.prepare(`INSERT INTO dashboard_staff(user_id,label,permissions,added_by,created_at,updated_at)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET label=excluded.label, permissions=excluded.permissions, updated_at=excluded.updated_at`).run(String(userId), String(label ?? ''), JSON.stringify(Array.isArray(permissions) ? permissions : []), String(addedBy ?? ''), now, now);
    return getDashboardStaff(userId);
}
function deleteDashboardStaff(userId) {
    return db.prepare('DELETE FROM dashboard_staff WHERE user_id=?').run(String(userId)).changes > 0;
}
function listDashboardBlacklist() {
    return db.prepare('SELECT * FROM dashboard_blacklist ORDER BY created_at DESC').all();
}
function isGuildBlacklisted(guildId) {
    return Boolean(db.prepare('SELECT 1 FROM dashboard_blacklist WHERE guild_id=?').get(String(guildId)));
}
function setGuildBlacklist(guildId, reason, addedBy) {
    db.prepare(`INSERT INTO dashboard_blacklist(guild_id,reason,added_by,created_at) VALUES(?,?,?,?)
    ON CONFLICT(guild_id) DO UPDATE SET reason=excluded.reason, added_by=excluded.added_by, created_at=excluded.created_at`).run(String(guildId), String(reason ?? ''), String(addedBy ?? ''), Date.now());
}
function removeGuildBlacklist(guildId) {
    return db.prepare('DELETE FROM dashboard_blacklist WHERE guild_id=?').run(String(guildId)).changes > 0;
}
function getManagedInvite(guildId) {
    return db.prepare('SELECT * FROM managed_invites WHERE guild_id=?').get(String(guildId)) ?? null;
}
function setManagedInvite(guildId, channelId, code, url) {
    const now = Date.now();
    db.prepare(`INSERT INTO managed_invites(guild_id,channel_id,code,url,created_at,updated_at)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id, code=excluded.code, url=excluded.url, updated_at=excluded.updated_at`)
        .run(String(guildId), String(channelId), String(code), String(url), now, now);
    return getManagedInvite(guildId);
}
function removeManagedInvite(guildId) {
    return db.prepare('DELETE FROM managed_invites WHERE guild_id=?').run(String(guildId)).changes > 0;
}
function listManagedInvites() {
    return db.prepare('SELECT * FROM managed_invites ORDER BY guild_id').all();
}
function addWelcomeAsset({ assetId, guildId, name, mime, filePath, size }) {
    db.prepare('INSERT INTO welcome_assets(asset_id,guild_id,name,mime,file_path,size,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(String(assetId), String(guildId), String(name), String(mime), String(filePath), Number(size) || 0, Date.now());
    return getWelcomeAsset(assetId, guildId);
}
function listWelcomeAssets(guildId) {
    return db.prepare('SELECT * FROM welcome_assets WHERE guild_id=? ORDER BY created_at DESC').all(String(guildId));
}
function getWelcomeAsset(assetId, guildId) {
    return db.prepare('SELECT * FROM welcome_assets WHERE asset_id=? AND guild_id=?').get(String(assetId), String(guildId)) ?? null;
}
function deleteWelcomeAsset(assetId, guildId) {
    return db.prepare('DELETE FROM welcome_assets WHERE asset_id=? AND guild_id=?').run(String(assetId), String(guildId)).changes > 0;
}
function getRuntime(key, fallback = null) {
    const row = db.prepare('SELECT value FROM bot_runtime WHERE key=?').get(String(key));
    if (!row)
        return fallback;
    try {
        return JSON.parse(row.value);
    }
    catch {
        return row.value;
    }
}
function setRuntime(key, value) {
    db.prepare(`INSERT INTO bot_runtime(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(String(key), JSON.stringify(value), Date.now());
    return value;
}
function auditDashboard(actorId, action, targetId = null, metadata = {}) {
    db.prepare('INSERT INTO dashboard_audit(actor_id,action,target_id,metadata,created_at) VALUES(?,?,?,?,?)').run(String(actorId), String(action), targetId == null ? null : String(targetId), JSON.stringify(metadata ?? {}), Date.now());
}
function recentDashboardAudit(limit = 100) {
    return db.prepare('SELECT * FROM dashboard_audit ORDER BY created_at DESC LIMIT ?').all(Math.max(1, Math.min(250, Number(limit) || 100)));
}

});
__factories.set("src/index.js", function(exports, require, module, __filename, __dirname) {
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("node:fs");
const dotenv_1 = __importDefault(require("dotenv"));
const discord_js_1 = require("discord.js");
const moderation_policy_js_1 = require("./lib/moderation-policy.js");
const config_js_1 = require("./config.js");
const db_js_1 = require("./db.js");
const commands_js_1 = require("./commands.js");
const core_js_1 = require("./lib/core.js");
const security_js_1 = require("./systems/security.js");
const community_js_1 = require("./systems/community.js");
const giveaways_js_1 = require("./systems/giveaways.js");
const polls_js_1 = require("./systems/polls.js");
const welcome_js_1 = require("./systems/welcome.js");
const reactions_js_1 = require("./systems/reactions.js");
const staff_activity_js_1 = require("./systems/staff-activity.js");
const db_js_2 = require("./db.js");
const invites_js_1 = require("./systems/invites.js");
const command_validation_js_1 = require("./lib/command-validation.js");
const bot_health_js_1 = require("./lib/bot-health.js");
dotenv_1.default.config();
if (!process.env.DISCORD_TOKEN) {
    console.error('Missing DISCORD_TOKEN in .env');
    process.exit(1);
}
const BOT_STARTED_AT = Date.now();
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMembers,
        discord_js_1.GatewayIntentBits.GuildModeration,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildMessageReactions,
        discord_js_1.GatewayIntentBits.GuildVoiceStates,
        discord_js_1.GatewayIntentBits.GuildInvites,
        discord_js_1.GatewayIntentBits.GuildWebhooks,
        discord_js_1.GatewayIntentBits.GuildExpressions,
        discord_js_1.GatewayIntentBits.GuildScheduledEvents
    ],
    partials: [discord_js_1.Partials.Channel, discord_js_1.Partials.Message, discord_js_1.Partials.Reaction, discord_js_1.Partials.User, discord_js_1.Partials.GuildMember]
});
client.commands = new discord_js_1.Collection();
for (const builder of (0, commands_js_1.buildCommands)())
    client.commands.set(builder.name, builder);
client.__auralisSnipe = new Map();
client.__auralisEditSnipe = new Map();
client.__auralisReactionSnipe = new Map();
client.__auralisSnipeProtect = new Set();
(0, bot_health_js_1.recordBotHealth)({ status: 'starting', client, startedAt: BOT_STARTED_AT });
const antiNukeActions = new Map();
function antiNukeModuleForAction(action) {
    if ([discord_js_1.AuditLogEvent.ChannelCreate, discord_js_1.AuditLogEvent.ChannelDelete, discord_js_1.AuditLogEvent.ChannelOverwriteCreate, discord_js_1.AuditLogEvent.ChannelOverwriteUpdate, discord_js_1.AuditLogEvent.ChannelOverwriteDelete].includes(action))
        return 'channel';
    if ([discord_js_1.AuditLogEvent.RoleCreate, discord_js_1.AuditLogEvent.RoleDelete, discord_js_1.AuditLogEvent.RoleUpdate].includes(action))
        return 'role';
    if ([discord_js_1.AuditLogEvent.MemberBanAdd, discord_js_1.AuditLogEvent.MemberBanRemove].includes(action))
        return 'ban';
    if ([discord_js_1.AuditLogEvent.MemberKick].includes(action))
        return 'kick';
    if ([discord_js_1.AuditLogEvent.BotAdd].includes(action))
        return 'botAdd';
    if ([discord_js_1.AuditLogEvent.WebhookCreate, discord_js_1.AuditLogEvent.WebhookDelete, discord_js_1.AuditLogEvent.WebhookUpdate].includes(action))
        return 'webhook';
    return null;
}
async function handleAntiNuke(guild, audit) {
    const cfg = (0, db_js_1.getGuildConfig)(guild.id);
    if (!cfg.antinuke.enabled || !audit.executorId || audit.executorId === guild.ownerId || audit.executorId === guild.client.user?.id || (cfg.antinuke.whitelist ?? []).includes(audit.executorId))
        return;
    const module = antiNukeModuleForAction(audit.action);
    if (!module || cfg.antinuke.modules?.[module] === false)
        return;
    const key = `${guild.id}:${audit.executorId}:${module}`;
    const now = Date.now();
    const list = antiNukeActions.get(key) ?? [];
    const cutoff = now - (cfg.antinuke.windowMs ?? 10000);
    list.push(now);
    while (list[0] < cutoff)
        list.shift();
    antiNukeActions.set(key, list);
    if (list.length <= (cfg.antinuke.maxActions ?? 3))
        return;
    const member = await guild.members.fetch(audit.executorId).catch(() => null);
    if (member?.manageable) {
        const manageable = member.roles.cache.filter(r => r.id !== guild.id && r.editable);
        await member.roles.remove(manageable, 'Auralis Anti-Nuke').catch(() => { });
    }
    logChannel(guild, 'antinuke', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Anti-Nuke', description: `Protected action threshold reached for <@${audit.executorId}>.\nModule: **${module}**\nActions: **${list.length}**`, color: config_js_1.config.brand.danger })] }, 'antinuke');
    antiNukeActions.set(key, []);
}
function countSlashCommandRoutes(commands) {
    return commands.reduce((total, command) => {
        const options = Array.isArray(command.options) ? command.options : [];
        const hasSubcommands = options.some(option => [1, 2].includes(Number(option.type)));
        if (!hasSubcommands)
            return total + 1;
        return total + options.reduce((count, option) => {
            if (Number(option.type) === 1)
                return count + 1;
            if (Number(option.type) === 2)
                return count + (Array.isArray(option.options) ? option.options.filter(child => Number(child.type) === 1).length : 0);
            return count;
        }, 0);
    }, 0);
}
async function registerCommands() {
    if (!process.env.DISCORD_CLIENT_ID)
        throw new Error('DISCORD_CLIENT_ID is empty. Set it to the Discord Application ID before starting Auralis.');
    const rest = new discord_js_1.REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const data = (0, commands_js_1.buildCommands)().map(command => command.toJSON());
    for (const command of data)
        (0, command_validation_js_1.normalizeRequiredOptions)(command.options);
    (0, command_validation_js_1.validateCommandOptionOrder)(data);
    if (data.length > 100)
        throw new Error(`Auralis defines ${data.length} top-level slash commands. Discord allows at most 100.`);
    const devGuildId = process.env.DEV_GUILD_ID;
    const guildScope = Boolean(devGuildId && config_js_1.config.discord.registerGuildCommandsInDevGuild);
    const route = guildScope
        ? discord_js_1.Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, devGuildId)
        : discord_js_1.Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
    const response = await rest.put(route, { body: data });
    const registeredCount = Array.isArray(response) ? response.length : data.length;
    const slashRoutes = countSlashCommandRoutes(data);
    const prefixCount = Object.keys((0, commands_js_1.getPrefixCommandDefinitions)()).length;
    const scope = guildScope ? `guild ${devGuildId}` : 'global';
    console.log(`[Auralis] Command sync successful: ${registeredCount} top-level ${scope} slash commands registered (${slashRoutes} callable slash routes including subcommands). ${prefixCount} prefix command definitions are loaded locally; prefix commands are not registered with Discord's slash-command API.`);
}
async function applyBotPresence() {
    const state = (0, db_js_1.getRuntime)('presence', { status: 'online', type: 'WATCHING', text: 'Support & Moderation' });
    const map = {
        PLAYING: discord_js_1.ActivityType.Playing,
        STREAMING: discord_js_1.ActivityType.Streaming,
        LISTENING: discord_js_1.ActivityType.Listening,
        WATCHING: discord_js_1.ActivityType.Watching,
        COMPETING: discord_js_1.ActivityType.Competing
    };
    const status = ['online', 'idle', 'dnd', 'invisible'].includes(String(state?.status).toLowerCase()) ? String(state.status).toLowerCase() : 'online';
    const text = String(state?.text ?? '').trim();
    const activityType = map[String(state?.type ?? 'WATCHING').toUpperCase()] ?? discord_js_1.ActivityType.Watching;
    client.user?.setPresence({ status, activities: text ? [{ name: text, type: activityType }] : [] });
}
function logChannel(guild, channelKey, payload, eventKey = channelKey) {
    if (!guild || !channelKey)
        return;
    const cfg = (0, db_js_1.getGuildConfig)(guild.id);
    const logging = cfg.loggingDefaults ?? {};
    if (cfg.modules?.logs === false || logging.enabled === false)
        return;
    if (eventKey && logging.events?.[eventKey] === false)
        return;
    const channels = logging.channels ?? {};
    const channelId = channels[channelKey] ?? (channelKey === 'audit' ? channels.antinuke : null) ?? channels.audit ?? channels.server;
    if (!channelId)
        return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel || typeof channel.send !== 'function')
        return;
    channel.send(payload).catch(error => console.warn(`[Auralis] could not send ${eventKey || channelKey} log in guild ${guild.id}: ${(0, core_js_1.cleanError)(error)}`));
}
async function handleMemberJoin(member) {
    try {
        (0, db_js_1.upsertBotGuildIndex)(member.guild);
    }
    catch { }
    const cfg = (0, db_js_1.getGuildConfig)(member.guild.id);
    if (cfg.modules?.autoroles !== false)
        for (const roleId of (0, community_js_1.listAutoroles)(member.guild.id)) {
            const role = member.guild.roles.cache.get(roleId);
            if (role?.editable)
                await member.roles.add(role).catch(() => { });
        }
    if (cfg.modules?.welcome !== false)
        await (0, welcome_js_1.sendWelcome)(member).catch(() => { });
    const raid = cfg.modules?.antiraid === false ? { triggered: false, count: 0 } : (0, security_js_1.antiRaidJoin)(member.guild.id, member.id, member.user.bot);
    if (raid.triggered) {
        logChannel(member.guild, 'antiraid', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Anti-Raid', description: `Join spike detected: **${raid.count}** joins in the configured window.`, color: config_js_1.config.brand.danger })] }, 'antiraid');
        if (cfg.antiRaid.action === 'verify_lockdown') {
            const overwrites = member.guild.roles.everyone;
            if (overwrites) {
                for (const channel of member.guild.channels.cache.filter(c => c.isTextBased() && c.permissionOverwrites).values()) {
                    await channel.permissionOverwrites.edit(overwrites, { SendMessages: false }, { reason: 'Auralis Anti-Raid lockdown' }).catch(() => { });
                }
                setTimeout(async () => {
                    for (const channel of member.guild.channels.cache.filter(c => c.isTextBased() && c.permissionOverwrites).values()) {
                        await channel.permissionOverwrites.edit(overwrites, { SendMessages: null }, { reason: 'Auralis Anti-Raid lockdown ended' }).catch(() => { });
                    }
                }, Math.max(1, Number(cfg.antiRaid.lockdownMinutes ?? 5)) * 60_000);
            }
        }
    }
    logChannel(member.guild, 'members', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Member joined', description: `${member} — ${member.user.tag}\nUser ID: ${member.id}`, color: config_js_1.config.brand.success })] }, 'joins');
}
async function handleMemberLeave(member) {
    try {
        (0, db_js_1.upsertBotGuildIndex)(member.guild);
    }
    catch { }
    const cfg = (0, db_js_1.getGuildConfig)(member.guild.id);
    if (cfg.welcomeDefaults.goodbyeEnabled && cfg.welcomeDefaults.goodbyeChannelId) {
        const channel = member.guild.channels.cache.get(cfg.welcomeDefaults.goodbyeChannelId);
        if (channel)
            await channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: cfg.welcomeDefaults.goodbyeTitle, description: (0, core_js_1.replacePlaceholders)(cfg.welcomeDefaults.goodbyeMessage, { user: member.user.tag, server: member.guild.name, username: member.user.username }), color: cfg.welcomeDefaults.goodbyeColor })] }).catch(() => { });
    }
    let kickEntry = null;
    try {
        const audit = await member.guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.MemberKick, limit: 5 });
        kickEntry = audit.entries.find(entry => String(entry.target?.id || entry.targetId || '') === String(member.id) && Date.now() - Number(entry.createdTimestamp || 0) < 15_000) || null;
    }
    catch { }
    if (kickEntry) {
        logChannel(member.guild, 'moderation', { embeds: [(0, core_js_1.makeEmbed)({
                    title: 'Member kicked',
                    description: `Member: <@${member.id}> (${member.user.tag})\nUser ID: ${member.id}\nModerator: ${kickEntry.executor ? `<@${kickEntry.executor.id}>` : 'Unknown'}\nReason: ${kickEntry.reason || 'No reason provided'}`,
                    color: config_js_1.config.brand.danger
                })] }, 'kicks');
    }
    logChannel(member.guild, 'members', { embeds: [(0, core_js_1.makeEmbed)({ title: kickEntry ? 'Member removed after kick' : 'Member left', description: `${member.user.tag} — ${member.id}`, color: config_js_1.config.brand.danger })] }, 'leaves');
}
function policyCounter(table, guildId, channelId, userId, windowSeconds) {
    const now = Date.now();
    const windowMs = Math.max(10, Number(windowSeconds) || 600) * 1000;
    const current = db_js_1.db.prepare(`SELECT count, window_start, last_timeout_at FROM ${table} WHERE guild_id=? AND channel_id=? AND user_id=?`).get(guildId, channelId, userId);
    let count = 1;
    let windowStart = now;
    let lastTimeoutAt = 0;
    if (current && now - Number(current.window_start) < windowMs) {
        count = Number(current.count || 0) + 1;
        windowStart = Number(current.window_start);
        lastTimeoutAt = Number(current.last_timeout_at || 0);
    }
    db_js_1.db.prepare(`INSERT INTO ${table}(guild_id,channel_id,user_id,count,window_start,last_timeout_at) VALUES(?,?,?,?,?,?) ON CONFLICT(guild_id,channel_id,user_id) DO UPDATE SET count=excluded.count,window_start=excluded.window_start,last_timeout_at=excluded.last_timeout_at`).run(guildId, channelId, userId, count, windowStart, lastTimeoutAt);
    return { count, windowStart, lastTimeoutAt, windowMs };
}
async function deliverPolicyNotice(message, cfg, text, mode = 'dm') {
    const clean = String(text || '').slice(0, 1900);
    if (!clean || mode === 'none')
        return;
    if (mode === 'dm' || mode === 'both')
        await message.author.send({ content: clean }).catch(() => { });
    if (mode === 'channel' || mode === 'both') {
        const sent = await message.channel.send({ content: `${message.author}, ${clean}` }).catch(() => null);
        if (sent)
            setTimeout(() => sent.delete().catch(() => { }), 8000).unref?.();
    }
}
async function handleHoneypotMessage(message, cfg) {
    const hp = cfg.honeypotDefaults || {};
    if (message.author?.bot || String(message.author?.id ?? '') === String(message.guild?.ownerId ?? ''))
        return false;
    if (cfg.modules?.honeypot === false || !hp.enabled || !Array.isArray(hp.channelIds) || !hp.channelIds.includes(message.channel.id))
        return false;
    if (hp.exemptStaff !== false && message.member && (message.member.permissions?.has(discord_js_1.PermissionFlagsBits.Administrator) || (0, core_js_1.isStaff)(message.member)))
        return false;
    await message.delete().catch(() => { });
    const count = policyCounter('honeypot_hits', message.guild.id, message.channel.id, message.author.id, hp.windowSeconds ?? 300);
    const threshold = Math.max(1, Number(hp.threshold) || 1);
    const logId = hp.logChannelId || cfg.loggingDefaults?.channels?.automod || cfg.loggingDefaults?.channels?.audit;
    const logChannel = logId ? message.guild.channels.cache.get(logId) : null;
    if (logChannel?.isTextBased()) {
        const log = await logChannel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Honeypot Triggered', description: `User: <@${message.author.id}> (${message.author.tag})\nChannel: <#${message.channel.id}>\nHits in window: **${count.count}**\nThreshold: **${threshold}**\nConfigured action: **${hp.action || 'log'}**`, color: config_js_1.config.brand.warning })] }).catch(() => null);
        void log;
    }
    if (count.count !== threshold || hp.action === 'log' || !hp.action) {
        if (hp.notifyUser)
            await message.author.send({ content: String(hp.noticeMessage || 'Your message was removed by the server security filter.') }).catch(() => { });
        return true;
    }
    const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
    const action = String(hp.action).toLowerCase();
    const reason = `Auralis Honeypot threshold reached (${count.count}/${threshold})`;
    const botMember = message.guild.members.me;
    const botAboveTarget = Boolean(botMember?.roles?.highest && member?.roles?.highest
        && botMember.roles.highest.comparePositionTo(member.roles.highest) > 0);
    const targetFailure = ['warn', 'timeout', 'kick', 'ban'].includes(action)
        ? (0, moderation_policy_js_1.automaticModerationTargetFailure)({
            targetId: message.author.id, guildOwnerId: message.guild.ownerId, botId: message.client.user?.id,
            targetIsBot: Boolean(message.author.bot), botAboveTarget,
            botCanAct: action === 'warn' ? true : action === 'timeout' ? Boolean(member?.moderatable)
                : action === 'kick' ? Boolean(member?.kickable) : Boolean(member?.bannable), action
        })
        : null;
    let applied = false;
    try {
        if (targetFailure) {
            console.warn(`[Auralis] honeypot punishment withheld for ${message.author.id}: ${targetFailure}`);
        }
        else if (action === 'warn') {
            (0, core_js_1.makeCase)(message.guild.id, message.author.id, message.client.user.id, 'HONEYPOT_WARN', reason, null, null, { channelId: message.channel.id, hits: count.count });
            applied = true;
        }
        else if (action === 'timeout' && member?.moderatable) {
            const seconds = Math.min(2419200, Math.max(1, Number(hp.timeoutSeconds) || 3600));
            await member.timeout(seconds * 1000, reason);
            (0, core_js_1.makeCase)(message.guild.id, message.author.id, message.client.user.id, 'HONEYPOT_TIMEOUT', reason, seconds * 1000, Date.now() + seconds * 1000, { channelId: message.channel.id, hits: count.count });
            applied = true;
        }
        else if (action === 'kick' && member?.kickable) {
            await member.kick(reason);
            (0, core_js_1.makeCase)(message.guild.id, message.author.id, message.client.user.id, 'HONEYPOT_KICK', reason, null, null, { channelId: message.channel.id, hits: count.count });
            applied = true;
        }
        else if (action === 'ban' && member?.bannable) {
            await message.guild.members.ban(message.author.id, { reason, deleteMessageSeconds: 0 });
            (0, core_js_1.makeCase)(message.guild.id, message.author.id, message.client.user.id, 'HONEYPOT_BAN', reason, null, null, { channelId: message.channel.id, hits: count.count });
            applied = true;
        }
    }
    catch (error) {
        console.warn(`[Auralis] honeypot action could not be applied: ${(0, core_js_1.cleanError)(error)}`);
    }
    if (hp.notifyUser)
        await message.author.send({ content: applied ? String(hp.punishedMessage || 'A security rule was triggered. Contact the server staff if you believe this was a mistake.') : String(hp.noticeMessage || 'Your message was removed by the server security filter.') }).catch(() => { });
    return true;
}
async function handleImageOnlyViolation(message, cfg) {
    await message.delete().catch(() => { });
    if (message.author?.bot || String(message.author?.id ?? '') === String(message.guild?.ownerId ?? ''))
        return;
    const policy = cfg.imageOnlyDefaults || {};
    const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
    const botMember = message.guild.members.me;
    const botAboveTarget = Boolean(botMember?.roles?.highest && member?.roles?.highest
        && botMember.roles.highest.comparePositionTo(member.roles.highest) > 0);
    const targetFailure = (0, moderation_policy_js_1.automaticModerationTargetFailure)({
        targetId: message.author.id, guildOwnerId: message.guild.ownerId, botId: message.client.user?.id,
        targetIsBot: Boolean(message.author.bot), botAboveTarget, botCanAct: true, action: 'warn'
    });
    if (targetFailure) {
        console.warn(`[Auralis] image-only punishment withheld for ${message.author.id}: ${targetFailure}`);
        return;
    }
    const count = policyCounter('image_only_violations', message.guild.id, message.channel.id, message.author.id, policy.warningWindowSeconds ?? 600);
    const warnAt = Math.max(1, Number(policy.warningThreshold) || 2);
    const timeoutAt = Math.max(warnAt, Number(policy.timeoutThreshold) || 5);
    if (policy.warningEnabled !== false && count.count >= warnAt && (count.count === warnAt || (policy.repeatWarnings && count.count % warnAt === 0))) {
        const id = (0, core_js_1.makeCase)(message.guild.id, message.author.id, message.client.user.id, 'IMAGE_ONLY_WARNING', `Text-only message in <#${message.channel.id}>`, null, null, { count: count.count });
        const text = String(policy.warningMessage || 'Only image messages are allowed in this channel.').replaceAll('{count}', String(count.count)).replaceAll('{channel}', `<#${message.channel.id}>`);
        await deliverPolicyNotice(message, cfg, `${text} (Case #${id})`, policy.notifyMode || 'dm');
    }
    if (policy.timeoutEnabled && count.count >= timeoutAt && count.lastTimeoutAt < count.windowStart) {
        if (member?.moderatable) {
            const seconds = Math.min(2419200, Math.max(1, Number(policy.timeoutSeconds) || 300));
            try {
                await member.timeout(seconds * 1000, `Image-only violations: ${count.count}`);
                const id = (0, core_js_1.makeCase)(message.guild.id, message.author.id, message.client.user.id, 'IMAGE_ONLY_TIMEOUT', `Exceeded image-only threshold (${count.count})`, seconds * 1000, Date.now() + seconds * 1000, { channelId: message.channel.id, count: count.count });
                db_js_1.db.prepare('UPDATE image_only_violations SET last_timeout_at=? WHERE guild_id=? AND channel_id=? AND user_id=?').run(Date.now(), message.guild.id, message.channel.id, message.author.id);
                await deliverPolicyNotice(message, cfg, `You were timed out for ${seconds} seconds for repeated image-only violations. Case #${id}`, policy.notifyMode || 'dm');
            }
            catch (error) {
                console.warn(`[Auralis] image-only timeout could not be applied: ${(0, core_js_1.cleanError)(error)}`);
            }
        }
    }
}
async function handleMessage(message) {
    if (!message.guild || message.author?.bot || message.author?.id === message.client.user?.id)
        return;
    const cfg = (0, db_js_1.getGuildConfig)(message.guild.id);
    const isGuildOwner = String(message.author.id) === String(message.guild.ownerId);
    if (!isGuildOwner && await handleHoneypotMessage(message, cfg))
        return;
    if ((0, core_js_1.isStaff)(message.member))
        (0, staff_activity_js_1.recordStaffMessage)(message.guild.id, message.author.id);
    if (!isGuildOwner && cfg.modules?.imageonly !== false && cfg.imageOnlyDefaults?.enabled !== false && (0, community_js_1.imageOnlyEnabled)(message.guild.id, message.channel.id)) {
        const imageExtensions = /\.(?:png|jpe?g|gif|webp|avif|bmp|tiff?)$/i;
        const hasImage = message.attachments.some(a => String(a.contentType || '').toLowerCase().startsWith('image/') || imageExtensions.test(a.name || a.url || ''));
        const valid = hasImage || (cfg.imageOnlyDefaults.allowStickers && message.stickers.size > 0) || (cfg.imageOnlyDefaults.allowEmbeds && message.embeds.length > 0) || (cfg.imageOnlyDefaults.allowLinks && /https?:\/\//i.test(message.content));
        if (!valid) {
            await handleImageOnlyViolation(message, cfg);
            return;
        }
    }
    const blocked = await (0, security_js_1.automodMessage)(message, client);
    if (blocked)
        return;
    const configuredPrefix = String(cfg.discord.defaultPrefix ?? config_js_1.config.discord.defaultPrefix ?? '.');
    const configuredAliases = Array.isArray(cfg.discord.prefixes) ? cfg.discord.prefixes : [];
    const allowedPrefixes = Array.isArray(cfg.discord.allowedPrefixes) ? cfg.discord.allowedPrefixes : (config_js_1.config.discord.allowedPrefixes ?? []);
    const prefixes = [...new Set([configuredPrefix, ...configuredAliases, ...allowedPrefixes].map(value => String(value ?? '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
    const matchedPrefix = prefixes.find(prefix => message.content.startsWith(prefix));
    if (cfg.discord.commandMentionFallback !== false && client.user && new RegExp(`^<@!?${client.user.id}>\\s*$`).test(message.content.trim())) {
        await message.reply({ content: `My prefix for this server is \`${configuredPrefix}\`. You can also use my slash commands with \`/\`. Use \`${configuredPrefix}help\` to see available prefix commands.` }).catch(() => { });
        return;
    }
    if (cfg.modules?.prefix !== false && cfg.prefixes?.enabled !== false && matchedPrefix) {
        const handled = await (0, commands_js_1.handlePrefix)(message, client, matchedPrefix);
        if (handled) {
            const shouldDeleteInvocation = message.__auralisCustomCommand
                ? Boolean(message.__auralisCustomCommandDeleteInvocation)
                : cfg.discord.deletePrefixCommands === true;
            if (shouldDeleteInvocation && message.deletable)
                await message.delete().catch(() => { });
            return;
        }
    }
    const afk = globalThis.__auralisAfk?.get(`${message.guild.id}:${message.author.id}`);
    if (afk) {
        globalThis.__auralisAfk.delete(`${message.guild.id}:${message.author.id}`);
        await message.reply({ content: `Welcome back. AFK removed.` }).catch(() => { });
    }
    const mentionedAfk = [...message.mentions.users.values()].map(u => globalThis.__auralisAfk?.get(`${message.guild.id}:${u.id}`)).filter(Boolean);
    if (mentionedAfk.length)
        await message.reply({ content: `That user is AFK: ${mentionedAfk[0]}` }).catch(() => { });
    if (cfg.modules?.sticky !== false)
        await (0, community_js_1.handleStickyMessage)(message).catch(() => { });
    if (cfg.modules?.levels !== false && cfg.levelDefaults.enabled) {
        const last = globalThis.__auralisLevelCooldown?.get(`${message.guild.id}:${message.author.id}`) ?? 0;
        if (Date.now() - last >= cfg.levelDefaults.cooldownSeconds * 1000) {
            globalThis.__auralisLevelCooldown ??= new Map();
            globalThis.__auralisLevelCooldown.set(`${message.guild.id}:${message.author.id}`, Date.now());
            const amount = (0, core_js_1.randomBetween)(cfg.levelDefaults.xpPerMessageMin, cfg.levelDefaults.xpPerMessageMax);
            const result = (0, community_js_1.addXp)(message.guild.id, message.author.id, amount, cfg);
            if (result.levelUp && cfg.levelDefaults.announceChannelId) {
                const channel = message.guild.channels.cache.get(cfg.levelDefaults.announceChannelId);
                await channel?.send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Level Up', description: `${message.author} reached **Level ${result.level}**.`, color: config_js_1.config.brand.success })] }).catch(() => { });
            }
        }
    }
}
client.on(discord_js_1.Events.MessageCreate, message => {
    void handleMessage(message).catch(error => console.warn(`[Auralis] message handler: ${(0, core_js_1.cleanError)(error)}`));
});
client.once(discord_js_1.Events.ClientReady, ready => {
    void (async () => {
        console.log(`[Auralis] Logged in as ${ready.user.tag}. Local command handlers: ${client.commands.size} slash definitions; ${Object.keys((0, commands_js_1.getPrefixCommandDefinitions)()).length} prefix definitions.`);
        for (const guild of client.guilds.cache.values()) {
            if ((0, db_js_1.isGuildBlacklisted)(guild.id))
                await guild.leave().catch(() => { });
        }
        const indexedGuilds = [...client.guilds.cache.values()].filter(guild => !(0, db_js_1.isGuildBlacklisted)(guild.id));
        for (const guild of indexedGuilds)
            (0, db_js_1.getGuildConfig)(guild.id);
        (0, db_js_1.syncBotGuildIndex)(indexedGuilds);
        console.log(`[Auralis] Indexed ${indexedGuilds.length} connected servers for the dashboard and website.`);
        (0, bot_health_js_1.recordBotHealth)({ status: 'online', client, startedAt: BOT_STARTED_AT });
        const heartbeatTimer = setInterval(() => {
            try {
                (0, bot_health_js_1.recordBotHealth)({ status: client.isReady() ? 'online' : 'reconnecting', client, startedAt: BOT_STARTED_AT });
            }
            catch (error) {
                console.warn(`[Auralis] bot health heartbeat failed: ${(0, core_js_1.cleanError)(error)}`);
            }
        }, 15_000);
        heartbeatTimer.unref?.();
        const guildIndexTimer = setInterval(() => {
            try {
                for (const guild of client.guilds.cache.values())
                    if (!(0, db_js_1.isGuildBlacklisted)(guild.id))
                        (0, db_js_1.upsertBotGuildIndex)(guild);
                (0, bot_health_js_1.recordBotHealth)({ status: client.isReady() ? 'online' : 'reconnecting', client, startedAt: BOT_STARTED_AT });
            }
            catch (error) {
                console.warn(`[Auralis] server index refresh failed: ${(0, core_js_1.cleanError)(error)}`);
            }
        }, 60_000);
        guildIndexTimer.unref?.();
        try {
            await registerCommands();
        }
        catch (error) {
            console.warn(`[Auralis] command registration failed: ${(0, core_js_1.cleanError)(error)}`);
        }
        await applyBotPresence();
        setInterval(() => applyBotPresence().catch(() => { }), 5000);
        await (0, invites_js_1.refreshManagedInvites)(client);
        await (0, staff_activity_js_1.sendScheduledStaffActivityChecks)(client).catch(error => console.warn(`[Auralis] staff activity scheduler: ${(0, core_js_1.cleanError)(error)}`));
        setInterval(() => (0, invites_js_1.refreshManagedInvites)(client).catch(() => { }), 10 * 60_000);
        setInterval(() => (0, staff_activity_js_1.sendScheduledStaffActivityChecks)(client).catch(error => console.warn(`[Auralis] staff activity scheduler: ${(0, core_js_1.cleanError)(error)}`)), 60_000);
        setInterval(async () => {
            for (const guild of client.guilds.cache.values())
                await (0, community_js_1.refreshCounters)(guild).catch(() => { });
        }, config_js_1.config.counterDefaults.updateIntervalMs);
        setInterval(async () => {
            try {
                const rows = db_js_1.db.prepare('SELECT * FROM reminders WHERE fire_at <= ? ORDER BY fire_at LIMIT 50').all(Date.now());
                for (const row of rows) {
                    db_js_1.db.prepare('DELETE FROM reminders WHERE id=?').run(row.id);
                    const user = await client.users.fetch(row.user_id).catch(() => null);
                    if (!user)
                        continue;
                    const channel = row.channel_id ? await client.channels.fetch(row.channel_id).catch(() => null) : null;
                    const payload = { embeds: [(0, core_js_1.makeEmbed)({ title: 'Reminder', description: row.message, color: config_js_1.config.brand.info })] };
                    if (channel?.isTextBased())
                        await channel.send(payload).catch(() => user.send(payload).catch(() => { }));
                    else
                        await user.send(payload).catch(() => { });
                }
            }
            catch (error) {
                console.warn(`[Auralis] reminder scheduler: ${(0, core_js_1.cleanError)(error)}`);
            }
        }, 10000);
        setInterval(async () => {
            try {
                for (const guild of client.guilds.cache.values()) {
                    for (const row of (0, giveaways_js_1.activeGiveaways)(guild.id)) {
                        if (row.end_at <= Date.now())
                            await (0, giveaways_js_1.finishGiveaway)(client, row).catch(error => console.warn(`[Auralis] giveaway scheduler could not finish ${row.message_id}: ${(0, core_js_1.cleanError)(error)}`));
                    }
                }
            }
            catch (error) {
                console.warn(`[Auralis] giveaway scheduler: ${(0, core_js_1.cleanError)(error)}`);
            }
        }, 5000);
        setInterval(async () => {
            try {
                for (const poll of (0, polls_js_1.activePolls)()) {
                    if (Number(poll.end_at) <= Date.now())
                        await (0, polls_js_1.finishPoll)(client, poll, 'expired');
                }
            }
            catch (error) {
                console.warn(`[Auralis] poll scheduler: ${(0, core_js_1.cleanError)(error)}`);
            }
        }, 5000);
        setInterval(async () => {
            try {
                const rows = db_js_1.db.prepare("SELECT * FROM cases WHERE type='TEMPBAN' AND active=1 AND expires_at IS NOT NULL AND expires_at <= ?").all(Date.now());
                for (const row of rows) {
                    const guild = client.guilds.cache.get(String(row.guild_id));
                    if (!guild)
                        continue;
                    try {
                        await guild.members.unban(String(row.user_id), `Auralis temporary ban expired (case #${row.id})`);
                        db_js_1.db.prepare('UPDATE cases SET active=0 WHERE id=? AND active=1').run(row.id);
                        const user = await client.users.fetch(String(row.user_id)).catch(() => null);
                        if (user) {
                            const templates = (0, db_js_1.getGuildConfig)(guild.id).dmTemplates ?? {};
                            await (0, core_js_1.dmTemplate)(user, guild, templates.tempbanExpired || 'Your temporary ban in {server} has expired. You may rejoin the server. Original case: #{caseId}.', {
                                moderator: 'Auralis automatic expiry', caseId: row.id, reason: 'The configured temporary-ban duration expired.'
                            });
                        }
                        console.log(`[Auralis] Temporary ban expired: guild=${guild.id} user=${row.user_id} case=#${row.id}`);
                    }
                    catch (error) {
                        if (Number(error?.code) === 10026) {
                            db_js_1.db.prepare('UPDATE cases SET active=0 WHERE id=? AND active=1').run(row.id);
                        }
                        else {
                            console.warn(`[Auralis] temporary-ban expiry will retry for case #${row.id}: ${(0, core_js_1.cleanError)(error)}`);
                        }
                    }
                }
            }
            catch (error) {
                console.warn(`[Auralis] tempban scheduler: ${(0, core_js_1.cleanError)(error)}`);
            }
        }, 15000);
    })().catch(error => console.warn(`[Auralis] startup task failed: ${(0, core_js_1.cleanError)(error)}`));
});
client.on(discord_js_1.Events.GuildCreate, guild => {
    void (async () => {
        if ((0, db_js_1.isGuildBlacklisted)(guild.id)) {
            console.log(`[Auralis] Leaving blacklisted guild ${guild.id}`);
            await guild.leave().catch(() => { });
            return;
        }
        (0, db_js_1.getGuildConfig)(guild.id);
        (0, db_js_1.getGuildConfig)(guild.id);
        (0, db_js_1.upsertBotGuildIndex)(guild);
        await (0, invites_js_1.ensureManagedInvite)(guild).catch(() => { });
    })().catch(error => console.warn(`[Auralis] guild-create handler failed: ${(0, core_js_1.cleanError)(error)}`));
});
client.on(discord_js_1.Events.InviteDelete, invite => { (0, invites_js_1.handleManagedInviteDelete)(invite).catch(error => console.warn(`[Auralis] invite-delete handler: ${(0, core_js_1.cleanError)(error)}`)); });
client.on(discord_js_1.Events.GuildDelete, guild => {
    try {
        (0, invites_js_1.removeManagedInviteForGuild)(guild.id);
    }
    catch (error) {
        console.warn(`[Auralis] guild-delete cleanup: ${(0, core_js_1.cleanError)(error)}`);
    }
    try {
        (0, db_js_1.removeBotGuildIndex)(guild.id);
    }
    catch (error) {
        console.warn(`[Auralis] guild index cleanup: ${(0, core_js_1.cleanError)(error)}`);
    }
    try {
        (0, bot_health_js_1.recordBotHealth)({ status: client.isReady() ? 'online' : 'reconnecting', client, startedAt: BOT_STARTED_AT });
    }
    catch { }
});
client.on(discord_js_1.Events.GuildUpdate, (_oldGuild, newGuild) => {
    try {
        if (!(0, db_js_1.isGuildBlacklisted)(newGuild.id))
            (0, db_js_1.upsertBotGuildIndex)(newGuild);
    }
    catch (error) {
        console.warn(`[Auralis] guild index update failed: ${(0, core_js_1.cleanError)(error)}`);
    }
});
client.on(discord_js_1.Events.ShardDisconnect, () => {
    try {
        (0, bot_health_js_1.recordBotHealth)({ status: 'reconnecting', client, startedAt: BOT_STARTED_AT });
    }
    catch { }
});
client.on(discord_js_1.Events.ShardReady, () => {
    try {
        if (client.isReady())
            (0, bot_health_js_1.recordBotHealth)({ status: 'online', client, startedAt: BOT_STARTED_AT });
    }
    catch { }
});
client.on(discord_js_1.Events.ShardResume, () => {
    try {
        if (client.isReady())
            (0, bot_health_js_1.recordBotHealth)({ status: 'online', client, startedAt: BOT_STARTED_AT });
    }
    catch { }
});
client.on(discord_js_1.Events.InteractionCreate, interaction => {
    void (interaction.isChatInputCommand() ? (0, commands_js_1.handleCommand)(interaction, client) : (0, commands_js_1.handleComponent)(interaction, client)).catch(async (error) => {
        const detail = (0, core_js_1.cleanError)(error);
        if (Number(error?.code) === 10062 || /unknown interaction/i.test(detail)) {
            console.warn(`[Auralis] Interaction token expired before a response could be updated (${interaction.commandName || interaction.customId || interaction.type}). Ensure handlers defer promptly; no duplicate response was attempted.`);
            return;
        }
        console.warn(`[Auralis] interaction could not be completed (${interaction.commandName || interaction.customId || interaction.type}): ${detail}`);
        if (error?.stack)
            console.warn(error.stack.split('\n').slice(0, 5).join('\n'));
        if (!interaction.isRepliable?.())
            return;
        const commandHint = interaction.isChatInputCommand?.() && interaction.commandName
            ? `Check the required options for /${interaction.commandName} and use /help to review its syntax.`
            : 'Please try the action again. If it keeps failing, ask a server administrator to review the Auralis logs.';
        const message = `Auralis could not finish that action. ${commandHint}`.slice(0, 1900);
        try {
            if (interaction.deferred)
                await interaction.editReply({ content: message, embeds: [], components: [] });
            else if (interaction.replied)
                await interaction.followUp({ content: message, ephemeral: true });
            else
                await (0, core_js_1.safeReply)(interaction, { content: message, ephemeral: true });
        }
        catch (replyError) {
            console.warn(`[Auralis] interaction error response failed: ${(0, core_js_1.cleanError)(replyError)}`);
        }
    });
});
client.on('error', error => {
    console.warn(`[Auralis] Discord client warning: ${(0, core_js_1.cleanError)(error)}`);
});
process.on('unhandledRejection', error => {
    console.warn(`[Auralis] Background operation was rejected: ${(0, core_js_1.cleanError)(error)}`);
});
client.on(discord_js_1.Events.MessageDelete, message => {
    try {
        if (!message.guild || !message.author || client.__auralisSnipeProtect.has(message.channel.id))
            return;
        const arr = client.__auralisSnipe.get(message.channel.id) ?? [];
        arr.unshift({ authorTag: message.author.tag, content: message.content, attachments: message.attachments.size, timestamp: Date.now() });
        client.__auralisSnipe.set(message.channel.id, arr.slice(0, config_js_1.config.snipeDefaults.cachePerChannel));
        const cfg = (0, db_js_1.getGuildConfig)(message.guild.id);
        const preview = cfg.loggingDefaults?.deletedMessagePreview === false ? 'Message content preview disabled by server settings.' : (message.content ? `> ${(0, core_js_1.truncate)(message.content, 1000)}` : 'No text content available.');
        const attachmentCount = Number(message.attachments?.size || 0);
        logChannel(message.guild, 'messages', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Message deleted', description: `${message.author} in ${message.channel}\nUser ID: ${message.author.id}\nMessage ID: ${message.id}\nAttachments: ${attachmentCount}\n\n${preview}`, color: config_js_1.config.brand.danger })] }, 'deletedMessages');
    }
    catch (error) {
        console.warn(`[Auralis] deleted-message handler: ${(0, core_js_1.cleanError)(error)}`);
    }
});
client.on(discord_js_1.Events.MessageUpdate, (oldMessage, newMessage) => {
    try {
        if (!oldMessage.guild || !newMessage.author || oldMessage.content === newMessage.content)
            return;
        client.__auralisEditSnipe.set(newMessage.channel.id, { authorTag: newMessage.author.tag, before: oldMessage.content, after: newMessage.content, timestamp: Date.now() });
        const cfg = (0, db_js_1.getGuildConfig)(newMessage.guild.id);
        const preview = cfg.loggingDefaults?.editedMessagePreview === false ? 'Before/after preview disabled by server settings.' : `**Before**\n${(0, core_js_1.truncate)(oldMessage.content, 900)}\n\n**After**\n${(0, core_js_1.truncate)(newMessage.content, 900)}`;
        logChannel(newMessage.guild, 'messages', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Message edited', description: `${newMessage.author} in ${newMessage.channel}\nUser ID: ${newMessage.author.id}\nMessage ID: ${newMessage.id}\n\n${preview}`, color: config_js_1.config.brand.warning })] }, 'editedMessages');
    }
    catch (error) {
        console.warn(`[Auralis] edited-message handler: ${(0, core_js_1.cleanError)(error)}`);
    }
});
client.on(discord_js_1.Events.MessageReactionAdd, async (reaction) => {
    try {
        if (reaction.partial)
            await reaction.fetch().catch(() => null);
        const guild = reaction.message?.guild;
        if (!guild)
            return;
        const binding = (0, reactions_js_1.reactionRole)(guild.id, reaction.message.id, reaction.emoji.toString());
        if (binding)
            logChannel(guild, 'reactions', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Reaction Role Added', description: `${binding.emoji} → <@&${binding.role_id}>\nMessage: ${reaction.message.url}`, color: config_js_1.config.brand.success })] }, 'reactionRoles');
    }
    catch (error) {
        console.warn(`[Auralis] reaction-add logger: ${(0, core_js_1.cleanError)(error)}`);
    }
});
client.on(discord_js_1.Events.MessageReactionRemove, reaction => { try {
    if (!reaction.message.guild)
        return;
    client.__auralisReactionSnipe.set(reaction.message.channel.id, { userTag: reaction.users?.cache?.first()?.tag ?? 'Unknown', emoji: reaction.emoji.toString(), timestamp: Date.now() });
    const binding = (0, reactions_js_1.reactionRole)(reaction.message.guild.id, reaction.message.id, reaction.emoji.toString());
    if (binding)
        logChannel(reaction.message.guild, 'reactions', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Reaction Role Removed', description: `${binding.emoji} → <@&${binding.role_id}>`, color: config_js_1.config.brand.info })] }, 'reactionRoles');
}
catch (error) {
    console.warn(`[Auralis] reaction handler: ${(0, core_js_1.cleanError)(error)}`);
} });
client.on(discord_js_1.Events.GuildMemberUpdate, (oldMember, newMember) => {
    try {
        const oldTimeout = oldMember.communicationDisabledUntilTimestamp || null;
        const newTimeout = newMember.communicationDisabledUntilTimestamp || null;
        const oldPremium = oldMember.premiumSinceTimestamp || null;
        const newPremium = newMember.premiumSinceTimestamp || null;
        if (oldPremium !== newPremium) {
            logChannel(newMember.guild, 'boosts', { embeds: [(0, core_js_1.makeEmbed)({ title: newPremium ? 'Server boosted' : 'Server boost ended', description: `${newMember} (${newMember.user.tag})\nUser ID: ${newMember.id}\n${newPremium ? `Boosted since <t:${Math.floor(newPremium / 1000)}:F>` : 'No longer boosting the server.'}`, color: newPremium ? config_js_1.config.brand.success : config_js_1.config.brand.warning })] }, 'boosts');
        }
        if (oldTimeout && !newTimeout) {
            db_js_1.db.prepare("UPDATE cases SET active=0 WHERE guild_id=? AND user_id=? AND type IN ('TIMEOUT','HONEYPOT_TIMEOUT') AND active=1").run(newMember.guild.id, newMember.id);
        }
        if (oldTimeout !== newTimeout) {
            const value = newTimeout ? `<t:${Math.floor(newTimeout / 1000)}:F>` : 'Timeout removed or expired';
            logChannel(newMember.guild, 'moderation', { embeds: [(0, core_js_1.makeEmbed)({ title: newTimeout ? 'Member timed out / timeout updated' : 'Member timeout removed', description: `${newMember} (${newMember.user.tag})\nUser ID: ${newMember.id}\n${value}`, color: newTimeout ? config_js_1.config.brand.warning : config_js_1.config.brand.success })] }, 'timeouts');
        }
        if (oldMember.nickname !== newMember.nickname) {
            logChannel(newMember.guild, 'members', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Nickname changed', description: `${newMember}\nBefore: ${oldMember.nickname || oldMember.user.username}\nAfter: ${newMember.nickname || newMember.user.username}\nUser ID: ${newMember.id}`, color: config_js_1.config.brand.info })] }, 'nicknames');
        }
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        const added = newRoles.filter(role => !oldRoles.has(role.id) && role.id !== newMember.guild.id).map(role => `<@&${role.id}>`);
        const removed = oldRoles.filter(role => !newRoles.has(role.id) && role.id !== newMember.guild.id).map(role => `<@&${role.id}>`);
        if (added.length || removed.length) {
            logChannel(newMember.guild, 'members', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Member roles updated', description: `${newMember} (${newMember.user.tag})\n${added.length ? `Added: ${added.join(', ')}` : ''}${added.length && removed.length ? '\n' : ''}${removed.length ? `Removed: ${removed.join(', ')}` : ''}\nUser ID: ${newMember.id}`, color: config_js_1.config.brand.info })] }, 'memberRoles');
        }
    }
    catch (error) {
        console.warn(`[Auralis] member-update logger failed: ${(0, core_js_1.cleanError)(error)}`);
    }
});
client.on(discord_js_1.Events.GuildMemberAdd, member => { void handleMemberJoin(member).catch(error => console.warn(`[Auralis] member-join handler: ${(0, core_js_1.cleanError)(error)}`)); });
client.on(discord_js_1.Events.GuildMemberRemove, member => { void handleMemberLeave(member).catch(error => console.warn(`[Auralis] member-leave handler: ${(0, core_js_1.cleanError)(error)}`)); });
client.on(discord_js_1.Events.MessageBulkDelete, messages => {
    try {
        const first = messages.first();
        const guild = first?.guild;
        if (!guild)
            return;
        logChannel(guild, 'messages', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Messages bulk deleted', description: `Channel: <#${first.channel.id}>\\nDeleted messages: **${messages.size}**\\nContent previews are omitted for bulk deletes.`, color: config_js_1.config.brand.danger })] }, 'purges');
    }
    catch (error) {
        console.warn(`[Auralis] bulk-delete logger: ${(0, core_js_1.cleanError)(error)}`);
    }
});
client.on(discord_js_1.Events.GuildRoleCreate, role => { logChannel(role.guild, 'roles', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Role created', description: `${role} — ${role.name}\\nRole ID: ${role.id}`, color: config_js_1.config.brand.success })] }, 'roles'); });
client.on(discord_js_1.Events.GuildRoleDelete, role => { logChannel(role.guild, 'roles', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Role deleted', description: `${role.name}\\nRole ID: ${role.id}`, color: config_js_1.config.brand.danger })] }, 'roles'); });
client.on(discord_js_1.Events.GuildRoleUpdate, (oldRole, newRole) => {
    const changes = [];
    if (oldRole.name !== newRole.name)
        changes.push(`Name: ${oldRole.name} → ${newRole.name}`);
    if (oldRole.hexColor !== newRole.hexColor)
        changes.push(`Color: ${oldRole.hexColor} → ${newRole.hexColor}`);
    if (oldRole.hoist !== newRole.hoist)
        changes.push(`Hoisted: ${oldRole.hoist} → ${newRole.hoist}`);
    if (oldRole.mentionable !== newRole.mentionable)
        changes.push(`Mentionable: ${oldRole.mentionable} → ${newRole.mentionable}`);
    if (changes.length)
        logChannel(newRole.guild, 'roles', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Role updated', description: `${newRole} — ${newRole.name}\\nRole ID: ${newRole.id}\\n${changes.join('\\n')}`, color: config_js_1.config.brand.warning })] }, 'roles');
});
client.on(discord_js_1.Events.ChannelCreate, channel => { if (channel.guild)
    logChannel(channel.guild, 'channels', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Channel created', description: `${channel} — ${channel.name}\\nChannel ID: ${channel.id}`, color: config_js_1.config.brand.success })] }, 'channels'); });
client.on(discord_js_1.Events.ChannelDelete, channel => { if (channel.guild)
    logChannel(channel.guild, 'channels', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Channel deleted', description: `${channel.name}\\nChannel ID: ${channel.id}`, color: config_js_1.config.brand.danger })] }, 'channels'); });
client.on(discord_js_1.Events.ChannelUpdate, (oldChannel, newChannel) => {
    if (!newChannel.guild)
        return;
    const changes = [];
    if (oldChannel.name !== newChannel.name)
        changes.push(`Name: ${oldChannel.name} → ${newChannel.name}`);
    if ('topic' in oldChannel && 'topic' in newChannel && oldChannel.topic !== newChannel.topic)
        changes.push('Topic changed');
    if ('nsfw' in oldChannel && 'nsfw' in newChannel && oldChannel.nsfw !== newChannel.nsfw)
        changes.push(`NSFW: ${oldChannel.nsfw} → ${newChannel.nsfw}`);
    if (changes.length)
        logChannel(newChannel.guild, 'channels', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Channel updated', description: `${newChannel}\\nChannel ID: ${newChannel.id}\\n${changes.join('\\n')}`, color: config_js_1.config.brand.warning })] }, 'channels');
});
client.on(discord_js_1.Events.WebhooksUpdate, channel => { if (channel.guild)
    logChannel(channel.guild, 'webhooks', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Webhooks updated', description: `Channel: ${channel}\\nChannel ID: ${channel.id}\\nDiscord does not expose the exact webhook change in this event.`, color: config_js_1.config.brand.warning })] }, 'webhooks'); });
client.on(discord_js_1.Events.VoiceStateUpdate, (oldState, newState) => {
    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;
    if (!guild || !member)
        return;
    if (oldState.channelId === newState.channelId && oldState.serverMute === newState.serverMute && oldState.serverDeaf === newState.serverDeaf && oldState.selfMute === newState.selfMute && oldState.selfDeaf === newState.selfDeaf)
        return;
    const from = oldState.channelId ? `<#${oldState.channelId}>` : 'not in voice';
    const to = newState.channelId ? `<#${newState.channelId}>` : 'not in voice';
    const details = [];
    if (oldState.channelId !== newState.channelId)
        details.push(`Channel: ${from} → ${to}`);
    if (oldState.serverMute !== newState.serverMute)
        details.push(`Server muted: ${newState.serverMute ? 'yes' : 'no'}`);
    if (oldState.serverDeaf !== newState.serverDeaf)
        details.push(`Server deafened: ${newState.serverDeaf ? 'yes' : 'no'}`);
    if (oldState.selfMute !== newState.selfMute)
        details.push(`Self-muted: ${newState.selfMute ? 'yes' : 'no'}`);
    if (oldState.selfDeaf !== newState.selfDeaf)
        details.push(`Self-deafened: ${newState.selfDeaf ? 'yes' : 'no'}`);
    logChannel(guild, 'voice', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Voice state changed', description: `${member} (${member.user.tag})\\n${details.join('\\n')}`, color: config_js_1.config.brand.info })] }, 'voice');
});
client.on(discord_js_1.Events.ThreadCreate, thread => { if (thread.guild)
    logChannel(thread.guild, 'threads', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Thread created', description: `${thread.name} in <#${thread.parentId}>\\nThread ID: ${thread.id}`, color: config_js_1.config.brand.success })] }, 'threads'); });
client.on(discord_js_1.Events.ThreadDelete, thread => { if (thread.guild)
    logChannel(thread.guild, 'threads', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Thread deleted', description: `${thread.name}\\nThread ID: ${thread.id}`, color: config_js_1.config.brand.danger })] }, 'threads'); });
client.on(discord_js_1.Events.ThreadUpdate, (oldThread, newThread) => { if (newThread.guild && oldThread.name !== newThread.name)
    logChannel(newThread.guild, 'threads', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Thread updated', description: `${oldThread.name} → ${newThread.name}\\nThread ID: ${newThread.id}`, color: config_js_1.config.brand.warning })] }, 'threads'); });
client.on(discord_js_1.Events.GuildEmojiCreate, emoji => { logChannel(emoji.guild, 'emojis', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Emoji created', description: `Name: \`:${emoji.name}:\`\nID: ${emoji.id}\nAnimated: ${emoji.animated ? 'yes' : 'no'}`, color: config_js_1.config.brand.success })] }, 'emojis'); });
client.on(discord_js_1.Events.GuildEmojiDelete, emoji => { logChannel(emoji.guild, 'emojis', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Emoji deleted', description: `Name: \`:${emoji.name}:\`\nID: ${emoji.id}`, color: config_js_1.config.brand.danger })] }, 'emojis'); });
client.on(discord_js_1.Events.GuildEmojiUpdate, (oldEmoji, newEmoji) => { if (oldEmoji.name !== newEmoji.name || oldEmoji.animated !== newEmoji.animated)
    logChannel(newEmoji.guild, 'emojis', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Emoji updated', description: `ID: ${newEmoji.id}\nBefore: \`:${oldEmoji.name}:\`\nAfter: \`:${newEmoji.name}:\``, color: config_js_1.config.brand.warning })] }, 'emojis'); });
client.on(discord_js_1.Events.GuildStickerCreate, sticker => { logChannel(sticker.guild, 'stickers', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Sticker created', description: `Name: ${sticker.name}\nID: ${sticker.id}\nFormat: ${sticker.format}`, color: config_js_1.config.brand.success })] }, 'stickers'); });
client.on(discord_js_1.Events.GuildStickerDelete, sticker => { logChannel(sticker.guild, 'stickers', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Sticker deleted', description: `Name: ${sticker.name}\nID: ${sticker.id}`, color: config_js_1.config.brand.danger })] }, 'stickers'); });
client.on(discord_js_1.Events.GuildStickerUpdate, (oldSticker, newSticker) => { if (oldSticker.name !== newSticker.name || oldSticker.description !== newSticker.description || oldSticker.tags !== newSticker.tags)
    logChannel(newSticker.guild, 'stickers', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Sticker updated', description: `ID: ${newSticker.id}\nBefore: ${oldSticker.name}\nAfter: ${newSticker.name}`, color: config_js_1.config.brand.warning })] }, 'stickers'); });
client.on(discord_js_1.Events.GuildScheduledEventCreate, event => { logChannel(event.guild, 'scheduledEvents', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Scheduled event created', description: `${event.name}\nEvent ID: ${event.id}\nStarts: ${event.scheduledStartTimestamp ? `<t:${Math.floor(event.scheduledStartTimestamp / 1000)}:F>` : 'Not set'}`, color: config_js_1.config.brand.success })] }, 'scheduledEvents'); });
client.on(discord_js_1.Events.GuildScheduledEventDelete, event => { logChannel(event.guild, 'scheduledEvents', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Scheduled event deleted', description: `${event.name}\nEvent ID: ${event.id}`, color: config_js_1.config.brand.danger })] }, 'scheduledEvents'); });
client.on(discord_js_1.Events.GuildScheduledEventUpdate, (oldEvent, newEvent) => { const changed = oldEvent.name !== newEvent.name || oldEvent.scheduledStartTimestamp !== newEvent.scheduledStartTimestamp || oldEvent.status !== newEvent.status || oldEvent.description !== newEvent.description; if (changed)
    logChannel(newEvent.guild, 'scheduledEvents', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Scheduled event updated', description: `${newEvent.name}\nEvent ID: ${newEvent.id}\nStatus: ${oldEvent.status} → ${newEvent.status}\nStart: ${newEvent.scheduledStartTimestamp ? `<t:${Math.floor(newEvent.scheduledStartTimestamp / 1000)}:F>` : 'Not set'}`, color: config_js_1.config.brand.warning })] }, 'scheduledEvents'); });
client.on(discord_js_1.Events.GuildUpdate, (oldGuild, newGuild) => { const changes = []; if (oldGuild.name !== newGuild.name)
    changes.push(`Name: ${oldGuild.name} → ${newGuild.name}`); if (oldGuild.icon !== newGuild.icon)
    changes.push('Server icon changed'); if (oldGuild.banner !== newGuild.banner)
    changes.push('Server banner changed'); if (oldGuild.description !== newGuild.description)
    changes.push('Server description changed'); if (oldGuild.verificationLevel !== newGuild.verificationLevel)
    changes.push(`Verification level: ${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`); if (changes.length)
    logChannel(newGuild, 'guildUpdates', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Server settings updated', description: changes.join('\n'), color: config_js_1.config.brand.warning })] }, 'guildUpdates'); });
client.on(discord_js_1.Events.InviteCreate, invite => { if (invite.guild)
    logChannel(invite.guild, 'invites', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Invite created', description: `Code: ${invite.code}\\nChannel: ${invite.channel ? `<#${invite.channel.id}>` : 'Unknown'}\\nCreated by: ${invite.inviter ? `<@${invite.inviter.id}>` : 'Unknown'}`, color: config_js_1.config.brand.success })] }, 'invites'); });
client.on(discord_js_1.Events.InviteDelete, invite => { if (invite.guild)
    logChannel(invite.guild, 'invites', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Invite deleted', description: `Code: ${invite.code}\\nChannel: ${invite.channel ? `<#${invite.channel.id}>` : 'Unknown'}`, color: config_js_1.config.brand.danger })] }, 'invites'); });
client.on(discord_js_1.Events.GuildAuditLogEntryCreate, (audit, guild) => { handleAntiNuke(guild, audit).catch(() => { }); });
client.on(discord_js_1.Events.GuildBanAdd, ban => { try {
    logChannel(ban.guild, 'moderation', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Member Banned', description: `${ban.user} — ${ban.reason ?? 'No reason'}\nUser ID: ${ban.user.id}`, color: config_js_1.config.brand.danger })] }, 'bans');
}
catch (error) {
    console.warn(`[Auralis] ban-add logger: ${(0, core_js_1.cleanError)(error)}`);
} });
client.on(discord_js_1.Events.GuildBanRemove, ban => { try {
    db_js_1.db.prepare("UPDATE cases SET active=0 WHERE guild_id=? AND user_id=? AND type IN ('BAN','TEMPBAN','HONEYPOT_BAN') AND active=1").run(ban.guild.id, ban.user.id);
    logChannel(ban.guild, 'moderation', { embeds: [(0, core_js_1.makeEmbed)({ title: 'Member Unbanned', description: `${ban.user}\nUser ID: ${ban.user.id}`, color: config_js_1.config.brand.success })] }, 'bans');
}
catch (error) {
    console.warn(`[Auralis] ban-remove logger: ${(0, core_js_1.cleanError)(error)}`);
} });
let shutdownStarted = false;
async function shutdownBot(signal, exitCode) {
    if (shutdownStarted)
        return;
    shutdownStarted = true;
    console.log(`[Auralis] shutting down (${signal})`);
    try {
        (0, bot_health_js_1.recordBotHealth)({ status: 'offline', client, startedAt: BOT_STARTED_AT });
    }
    catch { }
    try {
        await client.destroy();
    }
    catch { }
    try {
        db_js_1.db.close();
    }
    catch { }
    process.exit(exitCode);
}
process.once('SIGINT', () => { void shutdownBot('SIGINT', 130); });
process.once('SIGTERM', () => { void shutdownBot('SIGTERM', 143); });
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error(`[Auralis] Discord login failed: ${(0, core_js_1.cleanError)(error)}`);
    process.exit(1);
});

});
__factories.set("src/lib/bot-health.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordBotHealth = recordBotHealth;
exports.getBotHealthSnapshot = getBotHealthSnapshot;
const db_js_1 = require("../db.js");
const HEALTH_KEY = 'bot_health';
const HEARTBEAT_TIMEOUT_MS = 45_000;
function recordBotHealth({ status = 'starting', client = null, startedAt = null } = {}) {
    const previous = (0, db_js_1.getRuntime)(HEALTH_KEY, {}) || {};
    const now = Date.now();
    const guilds = (0, db_js_1.listBotGuildIndex)();
    const nextStatus = ['starting', 'online', 'reconnecting', 'offline'].includes(String(status)) ? String(status) : 'offline';
    const knownStartedAt = Number(startedAt || previous.startedAt || 0) || (nextStatus === 'online' ? now : null);
    const value = {
        status: nextStatus,
        heartbeatAt: now,
        startedAt: knownStartedAt,
        lastOnlineAt: nextStatus === 'online' && (String(previous.status || '') !== 'online' || now - Number(previous.heartbeatAt || 0) > HEARTBEAT_TIMEOUT_MS)
            ? now : (Number(previous.lastOnlineAt || 0) || null),
        guildCount: guilds.length,
        memberCount: guilds.reduce((total, guild) => total + Math.max(0, Number(guild.member_count || 0)), 0),
        latencyMs: Number.isFinite(Number(client?.ws?.ping)) && Number(client.ws.ping) >= 0 ? Math.round(Number(client.ws.ping)) : null
    };
    (0, db_js_1.setRuntime)(HEALTH_KEY, value);
    return value;
}
function getBotHealthSnapshot(now = Date.now()) {
    const saved = (0, db_js_1.getRuntime)(HEALTH_KEY, null);
    const heartbeatAt = Number(saved?.heartbeatAt || 0);
    const heartbeatFresh = heartbeatAt > 0 && now - heartbeatAt <= HEARTBEAT_TIMEOUT_MS;
    const savedStatus = String(saved?.status || 'offline').toLowerCase();
    const status = heartbeatFresh && ['online', 'reconnecting', 'starting'].includes(savedStatus) ? savedStatus : 'offline';
    const guilds = (0, db_js_1.listBotGuildIndex)();
    const memberCount = guilds.reduce((total, guild) => total + Math.max(0, Number(guild.member_count || 0)), 0);
    const startedAt = Number(saved?.startedAt || 0) || null;
    return {
        status,
        online: status === 'online',
        heartbeatAt: heartbeatAt || null,
        heartbeatAgeMs: heartbeatAt ? Math.max(0, now - heartbeatAt) : null,
        checkedAt: new Date(now).toISOString(),
        lastOnlineAt: Number(saved?.lastOnlineAt || 0) || null,
        guildCount: guilds.length,
        memberCount,
        latencyMs: status === 'online' && Number.isFinite(Number(saved?.latencyMs)) && saved?.latencyMs != null ? Number(saved.latencyMs) : null,
        uptimeSeconds: status === 'online' && startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : null
    };
}

});
__factories.set("src/lib/command-validation.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRequiredOptions = normalizeRequiredOptions;
exports.validateCommandOptionOrder = validateCommandOptionOrder;
function normalizeRequiredOptions(options) {
    if (!Array.isArray(options) || options.length === 0)
        return;
    const nested = options.some(option => option.type === 1 || option.type === 2);
    if (nested) {
        for (const option of options) {
            if (option.type === 1 || option.type === 2)
                normalizeRequiredOptions(option.options);
        }
        return;
    }
    options.sort((a, b) => Number(b.required === true) - Number(a.required === true));
}
function validateCommandOptionOrder(commandData) {
    const inspect = (options, commandPath) => {
        if (!Array.isArray(options))
            return;
        const nested = options.filter(option => option.type === 1 || option.type === 2);
        if (nested.length) {
            for (const child of nested)
                inspect(child.options, `${commandPath} ${child.name}`);
            return;
        }
        let optionalSeen = false;
        for (const option of options) {
            if (option.required !== true)
                optionalSeen = true;
            if (option.required === true && optionalSeen) {
                throw new Error(`Invalid slash command option order in ${commandPath}: required option \`${option.name}\` appears after an optional option. Required options must come first.`);
            }
        }
    };
    for (const command of commandData)
        inspect(command.options, `/${command.name}`);
}

});
__factories.set("src/lib/core.js", function(exports, require, module, __filename, __dirname) {
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.colors = void 0;
exports.now = now;
exports.sleep = sleep;
exports.parseDuration = parseDuration;
exports.formatDuration = formatDuration;
exports.titleCase = titleCase;
exports.replacePlaceholders = replacePlaceholders;
exports.truncate = truncate;
exports.cleanError = cleanError;
exports.fetchJson = fetchJson;
exports.makeEmbed = makeEmbed;
exports.safeComponentEmoji = safeComponentEmoji;
exports.safeReply = safeReply;
exports.deferEphemeral = deferEphemeral;
exports.isStaff = isStaff;
exports.isAdmin = isAdmin;
exports.canManageMember = canManageMember;
exports.memberMention = memberMention;
exports.makeCase = makeCase;
exports.fetchCases = fetchCases;
exports.fetchCase = fetchCase;
exports.updateCaseReason = updateCaseReason;
exports.relativeTime = relativeTime;
exports.hashNumber = hashNumber;
exports.randomBetween = randomBetween;
exports.safeHexColor = safeHexColor;
exports.colorBar = colorBar;
exports.pageSlice = pageSlice;
exports.escapeRegExp = escapeRegExp;
exports.splitContent = splitContent;
exports.dmTemplate = dmTemplate;
const node_crypto_1 = __importDefault(require("node:crypto"));
const discord_js_1 = require("discord.js");
const config_js_1 = require("../config.js");
const db_js_1 = require("../db.js");
exports.colors = config_js_1.config.brand;
function now() { return Date.now(); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function parseDuration(input) {
    if (typeof input !== 'string')
        return null;
    const match = input.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)(s|m|h|d|w)$/);
    if (!match)
        return null;
    const n = Number(match[1]);
    const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[match[2]];
    const ms = Math.round(n * mult);
    return Number.isFinite(ms) && ms > 0 ? ms : null;
}
function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0)
        return '0s';
    const parts = [];
    const units = [['w', 604800000], ['d', 86400000], ['h', 3600000], ['m', 60000], ['s', 1000]];
    let remaining = ms;
    for (const [name, value] of units) {
        const count = Math.floor(remaining / value);
        if (count) {
            parts.push(`${count}${name}`);
            remaining -= count * value;
        }
        if (parts.length >= 2)
            break;
    }
    return parts.join(' ');
}
function titleCase(value) {
    return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
}
function replacePlaceholders(text, values = {}) {
    if (text == null)
        return '';
    return String(text).replace(/\{([\w.-]+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}
function truncate(value, max = 1024) {
    const s = String(value ?? '');
    return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}
function cleanError(error) {
    const text = error instanceof Error ? error.message : String(error);
    return truncate(text.replace(/[\r\n]+/g, ' '), 240);
}
async function fetchJson(url, options = {}) {
    const timeoutMs = Math.max(1000, Math.min(30000, Number(options.timeoutMs ?? 10000)));
    const requestOptions = { ...options };
    delete requestOptions.timeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Request timed out.')), timeoutMs);
    try {
        const response = await fetch(url, {
            ...requestOptions,
            signal: requestOptions.signal ?? controller.signal,
            headers: { Accept: 'application/json', ...(requestOptions.headers ?? {}) }
        });
        const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
        const body = await response.text();
        const host = (() => { try {
            return new URL(url).hostname;
        }
        catch {
            return 'the external service';
        } })();
        if (!response.ok)
            throw new Error(`${host} returned HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`);
        if (contentType.includes('text/html') || /^\s*<!doctype html|^\s*<html[\s>]/i.test(body)) {
            throw new Error(`${host} returned an HTML page instead of JSON. The service may be unavailable, blocking requests, or rate-limiting the bot.`);
        }
        try {
            return JSON.parse(body);
        }
        catch {
            throw new Error(`${host} returned an invalid JSON response (content type: ${contentType || 'unknown'}).`);
        }
    }
    catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError' || error?.cause?.name === 'AbortError')
            throw new Error('The external service timed out. Please try again later.');
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
}
function makeEmbed({ title, description, color = config_js_1.config.brand.primary, fields, thumbnail, image, url, timestamp = true, footer } = {}) {
    const clean = value => String(value ?? '').replace(/[•—]/g, '—');
    const embed = new discord_js_1.EmbedBuilder().setColor(color);
    if (title)
        embed.setTitle(clean(title));
    if (description)
        embed.setDescription(clean(description));
    if (fields?.length)
        embed.addFields(fields.map(field => ({ ...field, name: clean(field.name), value: clean(field.value) })));
    if (thumbnail)
        embed.setThumbnail(thumbnail);
    if (image)
        embed.setImage(image);
    if (url)
        embed.setURL(url);
    if (timestamp)
        embed.setTimestamp();
    if (footer && config_js_1.config.brand.embedFooter)
        embed.setFooter({ text: clean(footer) });
    return embed;
}
function safeComponentEmoji(value) {
    const raw = String(value ?? '').trim();
    if (!raw)
        return null;
    try {
        const parsed = (0, discord_js_1.parseEmoji)(raw);
        if (!parsed?.name)
            return null;
        if (parsed.id) {
            if (!/^\d{17,20}$/.test(String(parsed.id)))
                return null;
            if (!/^(?:<a?:)?[a-zA-Z0-9_]{2,32}:?\d{17,20}>?$/.test(raw))
                return null;
            return { id: String(parsed.id), name: String(parsed.name), animated: Boolean(parsed.animated) };
        }
        const hasEmojiPresentation = /\p{Emoji_Presentation}/u.test(raw);
        const hasVariationSequence = raw.includes('\uFE0F') && /\p{Emoji}/u.test(raw);
        const hasJoinerSequence = raw.includes('\u200D') && /\p{Extended_Pictographic}/u.test(raw);
        if (!hasEmojiPresentation && !hasVariationSequence && !hasJoinerSequence)
            return null;
        return { name: raw };
    }
    catch {
        return null;
    }
}
function normalizeReplyPayload(payload, allowFlags = true) {
    const normalized = { ...(payload ?? {}) };
    const legacyEphemeral = normalized.ephemeral;
    delete normalized.ephemeral;
    if (allowFlags && legacyEphemeral)
        normalized.flags = (Number(normalized.flags) || 0) | discord_js_1.MessageFlags.Ephemeral;
    return normalized;
}
async function safeReply(interaction, payload) {
    if (!interaction || typeof interaction.reply !== 'function')
        throw new TypeError('A valid Discord interaction is required.');
    if (interaction.deferred || interaction.replied)
        return interaction.editReply(normalizeReplyPayload(payload, false));
    return interaction.reply(normalizeReplyPayload(payload, true));
}
async function deferEphemeral(interaction) {
    if (!interaction?.deferred && !interaction?.replied)
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
}
function isStaff(member) {
    if (!member)
        return false;
    const isOwner = String(member.id ?? '') === String(member.guild?.ownerId ?? '');
    return isOwner || member.permissions?.has(discord_js_1.PermissionFlagsBits.Administrator) || member.permissions?.has(discord_js_1.PermissionFlagsBits.ManageGuild) || member.permissions?.has(discord_js_1.PermissionFlagsBits.ManageMessages);
}
function isAdmin(member) {
    if (!member)
        return false;
    return String(member.id ?? '') === String(member.guild?.ownerId ?? '') || member.permissions?.has(discord_js_1.PermissionFlagsBits.Administrator);
}
function canManageMember(actor, target) {
    if (!actor || !target || target.id === actor.id)
        return false;
    const ownerId = String(target.guild?.ownerId ?? actor.guild?.ownerId ?? '');
    if (String(target.id) === ownerId)
        return false;
    if (String(actor.id) === ownerId)
        return true;
    if (!actor.roles?.highest || !target.roles?.highest)
        return false;
    return actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}
function memberMention(id) { return `<@${id}>`; }
function makeCase(guildId, userId, moderatorId, type, reason, durationMs = null, expiresAt = null, metadata = {}) {
    const result = db_js_1.db.prepare('INSERT INTO cases(guild_id,user_id,moderator_id,type,reason,duration_ms,created_at,expires_at,metadata) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(guildId, userId, moderatorId, type, reason ?? 'No reason provided.', durationMs, now(), expiresAt, JSON.stringify(metadata));
    return Number(result.lastInsertRowid);
}
function fetchCases(guildId, userId, limit = 25) {
    return db_js_1.db.prepare('SELECT * FROM cases WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?').all(guildId, userId, limit);
}
function fetchCase(id, guildId = null) {
    return guildId ? db_js_1.db.prepare('SELECT * FROM cases WHERE id = ? AND guild_id = ?').get(id, guildId) : db_js_1.db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
}
function updateCaseReason(id, guildId, reason) {
    return db_js_1.db.prepare('UPDATE cases SET reason = ? WHERE id = ? AND guild_id = ?').run(reason, id, guildId).changes > 0;
}
function relativeTime(ms) {
    const seconds = Math.round((ms - Date.now()) / 1000);
    if (Math.abs(seconds) < 60)
        return seconds >= 0 ? `in ${Math.abs(seconds)}s` : `${Math.abs(seconds)}s ago`;
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60)
        return minutes >= 0 ? `in ${Math.abs(minutes)}m` : `${Math.abs(minutes)}m ago`;
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24)
        return hours >= 0 ? `in ${Math.abs(hours)}h` : `${Math.abs(hours)}h ago`;
    const days = Math.round(hours / 24);
    return days >= 0 ? `in ${Math.abs(days)}d` : `${Math.abs(days)}d ago`;
}
function hashNumber(input, max) {
    const hash = node_crypto_1.default.createHash('sha256').update(String(input)).digest();
    return hash.readUInt32BE(0) % max;
}
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function safeHexColor(input, fallback = config_js_1.config.brand.primary) {
    const match = String(input ?? '').trim().match(/^#?([0-9a-f]{6})$/i);
    return match ? parseInt(match[1], 16) : fallback;
}
function colorBar(value, max, length = 12) {
    const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
    const filled = Math.round(ratio * length);
    return `${'▰'.repeat(filled)}${'▱'.repeat(length - filled)}`;
}
function pageSlice(items, page, perPage) {
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    const current = Math.min(Math.max(1, page), totalPages);
    return { page: current, totalPages, items: items.slice((current - 1) * perPage, current * perPage) };
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function splitContent(text, max = 2000) {
    const chunks = [];
    let rest = String(text);
    while (rest.length > max) {
        let cut = rest.lastIndexOf('\n', max);
        if (cut < max * 0.5)
            cut = max;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut).replace(/^\n/, '');
    }
    if (rest)
        chunks.push(rest);
    return chunks;
}
async function dmTemplate(user, guild, template, values = {}) {
    const resolved = replacePlaceholders(template, {
        user: user.toString(),
        server: guild?.name ?? 'the server',
        moderator: values.moderator ?? 'Auralis Staff',
        reason: values.reason ?? 'No reason provided.',
        duration: values.duration ?? 'N/A',
        ...values
    });
    try {
        await user.send({ embeds: [makeEmbed({ title: 'Auralis', description: resolved, color: config_js_1.config.brand.primary })] });
        return true;
    }
    catch {
        return false;
    }
}

});
__factories.set("src/lib/moderation-policy.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moderationTargetFailure = moderationTargetFailure;
exports.automaticModerationTargetFailure = automaticModerationTargetFailure;
function moderationTargetFailure({ actorId, targetId, guildOwnerId, botId, actorIsOwner = false, actorAboveTarget = false, botAboveTarget = false, botCanAct = true, action = 'moderate' } = {}) {
    const actor = String(actorId ?? '');
    const target = String(targetId ?? '');
    const owner = String(guildOwnerId ?? '');
    const bot = String(botId ?? '');
    const actionLabel = String(action || 'moderate').toLowerCase();
    if (!target)
        return 'Member not found. Select a current member of this server.';
    if (actor && target === actor)
        return 'You cannot apply moderation actions to yourself. Select a different server member.';
    if (bot && target === bot)
        return 'Auralis cannot be a moderation target. Select a different server member.';
    if (owner && target === owner)
        return 'The server owner is protected and cannot be moderated by bot commands.';
    if (!actorIsOwner && actorAboveTarget !== true) {
        return 'You cannot moderate this member because their highest role is equal to or above yours. Your highest role must be higher; Administrator does not bypass Discord role hierarchy.';
    }
    if (botAboveTarget !== true) {
        return 'Auralis cannot moderate this member because its highest role is not above the target member. Move Auralis above the target role and try again.';
    }
    if (botCanAct !== true) {
        const missing = {
            ban: 'Ban Members permission or a manageable target role',
            kick: 'Kick Members permission or a manageable target role',
            timeout: 'Moderate Members permission or a manageable target role',
            roles: 'Manage Roles permission or a manageable target role'
        }[actionLabel] || 'the required bot permission or role hierarchy';
        return `Auralis cannot complete this action because it lacks ${missing}. Check the bot permissions and role order.`;
    }
    return null;
}
function automaticModerationTargetFailure({ targetId, guildOwnerId, botId, targetIsBot = false, botAboveTarget = false, botCanAct = true, action = 'moderate' } = {}) {
    const target = String(targetId ?? '');
    const owner = String(guildOwnerId ?? '');
    const bot = String(botId ?? '');
    const actionLabel = String(action || 'moderate').toLowerCase();
    if (!target)
        return 'The target member could not be resolved; no automatic punishment was applied.';
    if (bot && target === bot)
        return 'Auralis is protected from its own automated punishments.';
    if (targetIsBot)
        return 'Bot accounts are excluded from automated punishments.';
    if (owner && target === owner)
        return 'The server owner is protected from automated punishments.';
    if (botAboveTarget !== true)
        return 'Auralis is not above the member in role hierarchy; no automatic punishment was applied.';
    if (botCanAct !== true) {
        const permission = {
            ban: 'Ban Members permission or a bannable target',
            kick: 'Kick Members permission or a kickable target',
            timeout: 'Moderate Members permission or a timeout-capable target',
            roles: 'Manage Roles permission or a manageable target'
        }[actionLabel] || 'the required bot permission';
        return `Auralis lacks ${permission}; no automatic punishment was applied.`;
    }
    return null;
}

});
__factories.set("src/lib/ui.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.button = button;
exports.row = row;
exports.select = select;
exports.modal = modal;
exports.setupMainComponents = setupMainComponents;
exports.inviteUrl = inviteUrl;
const discord_js_1 = require("discord.js");
const config_js_1 = require("../config.js");
const core_js_1 = require("./core.js");
function button(customId, label, style = discord_js_1.ButtonStyle.Secondary, emoji = null, disabled = false) {
    const safeLabel = String(label ?? '').trim() || 'Open';
    const b = new discord_js_1.ButtonBuilder().setCustomId(customId).setLabel(safeLabel).setStyle(style).setDisabled(disabled);
    const parsedEmoji = (0, core_js_1.safeComponentEmoji)(emoji);
    if (parsedEmoji)
        b.setEmoji(parsedEmoji);
    return b;
}
function row(...components) { return new discord_js_1.ActionRowBuilder().addComponents(components); }
function select(customId, placeholder, options, minValues = 1, maxValues = 1) {
    const menu = new discord_js_1.StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(minValues).setMaxValues(maxValues);
    menu.addOptions(options.map(option => option instanceof discord_js_1.StringSelectMenuOptionBuilder ? option : new discord_js_1.StringSelectMenuOptionBuilder(option)));
    return menu;
}
function modal(customId, title, fields) {
    const m = new discord_js_1.ModalBuilder().setCustomId(customId).setTitle(title);
    m.addComponents(...fields.map(field => new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
        .setCustomId(field.id).setLabel(field.label).setStyle(field.style ?? discord_js_1.TextInputStyle.Paragraph)
        .setRequired(field.required ?? false).setMinLength(field.minLength ?? 0).setMaxLength(field.maxLength ?? 4000)
        .setPlaceholder(field.placeholder ?? '').setValue(field.value ?? ''))));
    return m;
}
function setupMainComponents() {
    return [
        row(button('setup:basic', 'Basic'), button('setup:tickets', 'Tickets'), button('setup:applications', 'Applications'), button('setup:moderation', 'Moderation')),
        row(button('setup:automod', 'Auto Mod'), button('setup:logs', 'Logs'), button('setup:security', 'Security'), button('setup:levels', 'Levels')),
        row(button('setup:welcome', 'Welcome'), button('setup:verify', 'Verify'), button('setup:community', 'Community'), button('setup:staffactivity', 'Staff Activity')),
        row(button('setup:close', 'Close', discord_js_1.ButtonStyle.Primary))
    ];
}
function inviteUrl(clientId, permissions = 0n) {
    const perms = permissions instanceof discord_js_1.PermissionsBitField ? permissions.bitfield : permissions;
    const params = new URLSearchParams({ client_id: clientId, scope: 'bot applications.commands', permissions: String(perms), integration_type: '0' });
    return `https://discord.com/oauth2/authorize?${params}`;
}

});
__factories.set("src/public-api.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicServers = publicServers;
exports.buildPublicCommandCatalog = buildPublicCommandCatalog;
exports.registerPublicRoutes = registerPublicRoutes;
const ui_js_1 = require("./lib/ui.js");
const discord_js_1 = require("discord.js");
const config_js_1 = require("./config.js");
const db_js_1 = require("./db.js");
const commands_js_1 = require("./commands.js");
const bot_health_js_1 = require("./lib/bot-health.js");
const cache = new Map();
const CACHE_MS = 5_000;
const slashCommandDefinitions = new Map((0, commands_js_1.buildCommands)().map(builder => [builder.name, builder.toJSON()]));
const prefixCommandDefinitions = (0, commands_js_1.getPrefixCommandDefinitions)();
function optionTokens(options = []) {
    return (Array.isArray(options) ? options : [])
        .filter(option => ![1, 2].includes(Number(option?.type)))
        .map(option => option.required ? `<${option.name}>` : `[${option.name}]`);
}
const optionHelp = {
    user: 'choose the Discord user this command affects', member: 'choose the server member this command affects', target: 'choose the member or user this action affects',
    reason: 'explain why this action is being taken; the reason can be stored in the audit history', duration: 'enter a duration such as 30m, 2h or 7d',
    warning_id: 'enter the ID of the active warning to remove', user_id: 'enter the Discord user ID, not a display name',
    channel: 'choose the channel where the action or panel should apply', role: 'choose the server role to add, remove or configure',
    message: 'enter the message text Auralis should send', title: 'enter the title shown above the embed content', description: 'enter the main text shown in the embed or panel',
    panel: 'enter the saved panel name or ID', page: 'choose the page number to display', amount: 'enter the number of messages or items to process',
    id: 'enter the ID of the case, application or saved item', query: 'enter the name, words or subject you want to search for',
    song: 'enter the song title and, if known, the artist', question: 'enter the question you want to ask', options: 'enter the options separated with the delimiter described by the command',
    prefix: 'enter the prefix to use in this server, such as . or !', name: 'enter a short name for the saved item', text: 'enter the text Auralis should use',
    color: 'enter a hex color such as #5865F2', type: 'choose the type of panel or action', enabled: 'choose whether the setting should be enabled',
    action: 'choose the action to perform from the options shown by Discord', status: 'choose the status to filter', code: 'enter the code or value to use', expression: 'enter a mathematical expression such as (12 + 8) / 2'
};
function describeOption(option) {
    const name = String(option?.name || 'value');
    const supplied = String(option?.description || '').trim();
    const hint = optionHelp[name.toLowerCase()] || (supplied.length > 12 ? supplied.toLowerCase() : `provide the ${name.replace(/[_-]/g, ' ')} for this command`);
    return `${option.required ? 'Required' : 'Optional'} ${name}: ${hint}`;
}
function usageVariants(command) {
    const options = Array.isArray(command.options) ? command.options : [];
    const variants = [];
    for (const option of options) {
        if (Number(option?.type) === 1) {
            const args = optionTokens(option.options).join(' ');
            variants.push({ usage: `/${command.name} ${option.name}${args ? ` ${args}` : ''}`, description: option.description || command.description || `Run ${command.name} ${option.name}.`, options: option.options || [] });
        }
        else if (Number(option?.type) === 2) {
            for (const subcommand of (Array.isArray(option.options) ? option.options : []).filter(item => Number(item?.type) === 1)) {
                const args = optionTokens(subcommand.options).join(' ');
                variants.push({ usage: `/${command.name} ${option.name} ${subcommand.name}${args ? ` ${args}` : ''}`, description: subcommand.description || option.description || command.description || `Run ${command.name} ${option.name} ${subcommand.name}.`, options: subcommand.options || [] });
            }
        }
    }
    if (variants.length)
        return variants;
    const args = optionTokens(options).join(' ');
    return [{ usage: `/${command.name}${args ? ` ${args}` : ''}`, description: command.description || `Run /${command.name}.`, options }];
}
function detailedVariantDescription(variant) {
    const supplied = String(variant.description || '').trim();
    const details = (variant.options || []).filter(option => ![1, 2].includes(Number(option?.type))).map(describeOption);
    return details.length ? `${supplied} ${details.join('. ')}.` : supplied;
}
function asset(hash, type, guildId, size = 512) {
    if (!hash)
        return null;
    const extension = hash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/${type}/${guildId}/${hash}.${extension}?size=${size}`;
}
async function publicServers() {
    const cached = cache.get('servers');
    if (cached && cached.expires > Date.now())
        return cached.value;
    const result = [];
    for (const guild of (0, db_js_1.listBotGuildIndex)()) {
        if ((0, db_js_1.isGuildBlacklisted)(guild.id))
            continue;
        const cfg = (0, db_js_1.getGuildConfig)(guild.id);
        if (cfg.publicDirectory?.enabled === false)
            continue;
        const hasDescription = typeof guild.description === 'string' && guild.description.trim().length > 0;
        if (cfg.publicDirectory?.requireDescription === true && !hasDescription)
            continue;
        const managedInvite = (0, db_js_1.getManagedInvite)(guild.id);
        const fallbackMode = String(cfg.publicDirectory?.descriptionMode ?? 'placeholder').toLowerCase();
        const fallbackText = String(cfg.publicDirectory?.descriptionFallback ?? '').trim();
        const description = hasDescription ? guild.description.trim() : (fallbackMode === 'blank' ? '' : fallbackText);
        result.push({
            id: guild.id,
            name: guild.name,
            description,
            members: Number(guild.approximate_member_count ?? guild.member_count ?? 0),
            icon: asset(guild.icon, 'icons', guild.id, 256),
            invite: managedInvite?.url || cfg.publicDirectory?.invite || (guild.vanity_url_code ? `https://discord.gg/${guild.vanity_url_code}` : null),
            sort: Number(cfg.publicDirectory?.order ?? 0),
            verified: Boolean(guild.features?.includes('VERIFIED')),
            partnered: Boolean(guild.features?.includes('PARTNERED'))
        });
    }
    result.sort((a, b) => b.members - a.members || b.sort - a.sort || a.name.localeCompare(b.name));
    cache.set('servers', { value: result, expires: Date.now() + CACHE_MS });
    return result;
}
function commandMeta(name, group) {
    const slash = `/${name}`;
    const descriptions = {
        setup: 'Open the interactive Auralis server configuration panel.', help: 'Browse commands by category and see each command’s options.', panel: 'Send a saved support, application, verification or staff panel.', tickets: 'List the currently open tickets in this server.', applications: 'Open or manage configured staff and partner applications.', close: 'Close the current ticket.', add: 'Add a member to the current ticket.', remove: 'Remove a member from the current ticket.', picperms: 'Toggle image permissions for a member.', stats: 'Show server ticket and moderation statistics.', leaderboard: 'Show the staff leaderboard by ticket closes.',
        warn: 'Warn a member, record a case and optionally send a DM.', warnings: 'Show a member’s active warnings.', unwarn: 'Remove one active warning while preserving its history.', clearwarnings: 'Clear active warnings without deleting the record.', punishmentstats: 'Show a member’s recorded punishment totals.', pardon: 'Clear active warnings and keep their history.', mute: 'Timeout a member for the chosen duration.', tempmute: 'Apply a temporary Discord timeout.', unmute: 'Remove a member’s current timeout.', history: 'Show the full moderation case history for a member.', caselog: 'Inspect a single moderation case.', reason: 'Update the reason stored on a moderation case.', ban: 'Permanently ban a member and record a case.', unban: 'Unban a user by ID.', banlist: 'Show the server ban list with pagination.', tempban: 'Temporarily ban a member and unban them automatically.', kick: 'Kick a member and record a case.', kicklist: 'Show recent kicks.', punish: 'Timeout a member for a chosen duration.', unpunish: 'Remove a member timeout.', untimeoutall: 'Remove active timeouts from all manageable members.', purge: 'Bulk delete recent messages.', cleanup: 'Delete bot and command messages from the channel.', selfpurge: 'Delete your own recent messages.', lockdown: 'Lock a text channel for regular members.', unlock: 'Unlock a text channel.', lockdownall: 'Lock every manageable text channel.', unlockdownall: 'Unlock every manageable text channel.', strip: 'Remove all manageable roles from a member.', jail: 'Move a member into the configured jail state.', unjail: 'Release a jailed member and restore their roles.', jailed: 'Show members who are currently jailed.', setjail: 'Configure the jail role and channel.', setjailauto: 'Configure one-click automatic jail settings.', hide: 'Hide a channel from a role or member.', unhide: 'Reveal a channel again.', slowmode: 'Set channel slowmode in seconds.', nsfw: 'Toggle a channel NSFW state.', audit: 'Inspect recent Discord audit log entries.', rollback: 'Review and reverse the latest compatible moderation action.',
        antinuke: 'View or change Auralis anti-nuke protection modules.', verify: 'Configure or publish the server verification panel.',
        poll: 'Create an interactive multi-option poll.', giveaways: 'Create and manage Auralis giveaways.', suggest: 'Submit or manage a server suggestion.', birthday: 'Set and manage server birthdays.', timezone: 'Set or view a member timezone.', time: 'Show a member local time.', level: 'View or configure XP levels and role rewards.', autorole: 'Configure automatic roles for joining members.', reactionrole: 'Bind message reactions to server roles.', buttonrole: 'Add role buttons to a bot message.', boosterrole: 'Manage custom booster roles.', tag: 'Create, edit and recall reusable tags.', customcmd: 'Create and manage custom prefix replies.', sticky: 'Create and manage sticky channel messages.', counter: 'Create and update live counter channels.', imgonly: 'Configure image-only channel protection.', voicemaster: 'Configure temporary voice channels.',
        serverinfo: 'Show information about the current Discord server.', userinfo: 'Show information about a Discord user.', channelinfo: 'Show details about a channel.', roleinfo: 'Show information about a role.', avatar: 'Show a user global avatar.', banner: 'Show a user global banner.', membercount: 'Show the server member breakdown.', roles: 'List server roles.', emojis: 'List custom server emojis.', stickers: 'List server stickers.', inrole: 'List members who have a specific role.', newusers: 'Show recently joined members.', boomer: 'Show the oldest members in the server.', invite: 'Generate the Auralis bot invite.', inviteinfo: 'Inspect a Discord invite code.', invites: 'List active server invites.', translate: 'Translate text to a selected language.', crypto: 'Show current cryptocurrency prices.', color: 'Inspect a hex color.', randomhex: 'Generate a random hex color.', remind: 'Create a personal reminder.', afk: 'Set your AFK status.', ping: 'Show Discord gateway latency.', botinfo: 'Show Auralis bot information.', prefix: 'Show the current server prefix.', embed: 'Open the custom embed builder.', announce: 'Send a staff announcement.', template: 'View or edit moderation DM templates.', webhook: 'Create and send messages through webhooks.'
    };
    const prefix = group === 'prefix' ? `.${name}` : slash;
    const usage = {
        setup: '/setup', panel: '/panel send <type> [channel] [panel]', help: '/help [category] [page]',
        tickets: '/tickets list · /tickets panel [panel] · /tickets stats · /tickets leaderboard',
        applications: '/applications panel [panel] · /applications list [status] · /applications review <id> <action> [reason]',
        staffactivity: '/staffactivity panel [channel] · /staffactivity check [user] · /staffactivity leaderboard [page]',
        warn: '/warn <user> [reason] · .warn @user [reason]', warnings: '/warnings <user>', unwarn: '/unwarn <warning_id> [reason]', clearwarnings: '/clearwarnings <user> [reason]', punishmentstats: '/punishmentstats <user>', pardon: '/pardon <user> [reason]',
        history: '/history <user>', caselog: '/caselog <id>', reason: '/reason <id> <new>', ban: '/ban <user> [reason] — .ban @user [reason]', unban: '/unban <user_id> [reason] · .unban <user_id> [reason]', banlist: '/banlist [page]', tempban: '/tempban <user> <duration> [reason] · .tempban @user <duration> [reason]', kick: '/kick <user> [reason] — .kick @user [reason]', kicklist: '/kicklist [page]', mute: '/mute <user> <duration> [reason]', tempmute: '/tempmute <user> <duration> [reason]', unmute: '/unmute <user> [reason]', punish: '/punish <user> <duration> [reason] · .punish @user <duration> [reason]', unpunish: '/unpunish <user> [reason] · .unpunish @user [reason]', untimeoutall: '/untimeoutall', purge: '/purge <amount> — .purge <amount>', cleanup: '/cleanup [amount]', selfpurge: '/selfpurge [amount]', lockdown: '/lockdown [channel] [reason] — .lockdown [#channel] [reason]', unlock: '/unlock [channel] — .unlock [#channel]', lockdownall: '/lockdownall — .lockdownall', unlockdownall: '/unlockdownall — .unlockdownall', strip: '/strip <user> [reason] · .strip @user [reason]', jail: '/jail <user> [reason] — .jail @user [reason]', unjail: '/unjail <user> — .unjail @user', hide: '/hide [channel] [role_or_user]', unhide: '/unhide [channel] [role_or_user]', slowmode: '/slowmode <seconds> — .slowmode <seconds>', nsfw: '/nsfw [channel] — .nsfw [#channel]', poll: '/poll <question> <options…>', giveaways: '/giveaways <start|end|reroll|cancel|list|edit>', level: '/level rank [user] · /level addrole <level> <role> · /level removerole <level>',
        autorole: '/autorole add <role> · /autorole remove <role> · /autorole list · /autorole reset',
        reactionrole: '/reactionrole add <msg> <emoji> <role> · /reactionrole remove <msg> <emoji> · /reactionrole removeall <msg> · /reactionrole list',
        buttonrole: '/buttonrole add <msg> <role> [style] [emoji] [label] · /buttonrole remove <msg> <index> · /buttonrole removeall <msg> · /buttonrole list',
        boosterrole: '/boosterrole color <hex> · /boosterrole rename <name> · /boosterrole remove · /boosterrole list',
        tag: '/tag get <name> · /tag add <name> <content> · /tag edit <name> <content> · /tag remove <name> · /tag list',
        customcmd: '/customcmd add <name> <reply> · /customcmd remove <name> · /customcmd list',
        sticky: '/sticky set <text> · /sticky remove · /sticky list',
        counter: '/counter add <channel> <metric> · /counter remove <channel> · /counter list',
        imgonly: '/imgonly add <channel> · /imgonly remove <channel> · /imgonly list · /imgonly configure [warnings] [threshold]',
        voicemaster: '/voicemaster setup [channel] · /voicemaster limit <number> · /voicemaster name <name>',
        honeypot: '/honeypot add <channel> · /honeypot remove <channel> · /honeypot list · /honeypot configure [enabled] [threshold] [action]',
        verify: '/verify setup <channel> <role>', inviteinfo: '/inviteinfo <code>', inrole: '/inrole <role>', remind: '/remind <duration> <message>', embed: '/embed', announce: '/announce <message>', template: '/template view · /template set <event> <message> · /template reset <event>', webhook: '/webhook create <name> · /webhook list · /webhook delete <id> · /webhook send <id> <message>'
    };
    return { name, group, usage: usage[name] || prefix, description: descriptions[name] || `Use ${prefix} to ${name.replace(/[-_]/g, ' ')}.` };
}
function commandCatalog() {
    const catalog = [];
    const slashSeen = new Set();
    for (const [group, names] of Object.entries(config_js_1.config.commandGroups)) {
        if (group === 'prefix')
            continue;
        for (const name of names) {
            const slashCommand = slashCommandDefinitions.get(name);
            if (!slashCommand || slashSeen.has(name))
                continue;
            slashSeen.add(name);
            for (const variant of usageVariants(slashCommand)) {
                catalog.push({
                    name: variant.usage.replace(/^\//, '').split(/\s+/).join(' '),
                    group,
                    usage: variant.usage,
                    description: detailedVariantDescription(variant),
                    kind: 'slash'
                });
            }
        }
    }
    for (const [name, definition] of Object.entries(prefixCommandDefinitions)) {
        catalog.push({
            name,
            group: 'prefix',
            usage: definition.usage || `.${name}`,
            description: definition.help || `Use the server's configured prefix with ${name}.`,
            kind: 'prefix'
        });
    }
    return catalog;
}
function buildPublicCommandCatalog() { return commandCatalog(); }
async function registerPublicRoutes(app) {
    app.get('/public/api/overview', async (_, res) => {
        const servers = await publicServers();
        const indexedGuilds = (0, db_js_1.listBotGuildIndex)();
        const installedServerCount = indexedGuilds.length;
        const membersReached = indexedGuilds.reduce((sum, guild) => sum + Math.max(0, Number(guild.approximate_member_count ?? guild.member_count ?? 0)), 0);
        const health = (0, bot_health_js_1.getBotHealthSnapshot)();
        res.set('Cache-Control', 'no-store');
        res.json({
            ok: true,
            generatedAt: new Date().toISOString(),
            brand: config_js_1.config.brand,
            stats: {
                servers: installedServerCount,
                publicServers: servers.length,
                members: membersReached,
                commands: commandCatalog().length
            },
            bot: { ...health, serverCount: installedServerCount, membersReached },
            links: config_js_1.config.links,
            invite: config_js_1.config.discord.installUrl || (0, ui_js_1.inviteUrl)(process.env.DISCORD_CLIENT_ID ?? '', discord_js_1.PermissionsBitField.resolve(config_js_1.config.discord.requiredBotPermissions))
        });
    });
    app.get('/public/api/status', (_, res) => {
        const health = (0, bot_health_js_1.getBotHealthSnapshot)();
        const labels = { online: 'Online', reconnecting: 'Reconnecting', starting: 'Starting', offline: 'Offline' };
        res.set('Cache-Control', 'no-store');
        res.json({
            ok: true,
            status: labels[health.status] || 'Offline',
            online: health.online,
            checkedAt: health.checkedAt,
            heartbeatAt: health.heartbeatAt ? new Date(health.heartbeatAt).toISOString() : null,
            heartbeatAgeMs: health.heartbeatAgeMs,
            lastOnlineAt: health.lastOnlineAt ? new Date(health.lastOnlineAt).toISOString() : null,
            servers: health.guildCount,
            members: health.memberCount,
            latencyMs: health.latencyMs,
            uptimeSeconds: health.uptimeSeconds
        });
    });
    app.get('/public/api/servers', async (_, res) => res.json({ servers: await publicServers() }));
    app.get('/public/api/commands', (_, res) => res.json({ groups: config_js_1.config.commandGroups, prefix: config_js_1.config.prefixes, catalog: commandCatalog() }));
}

});
__factories.set("src/systems/applications.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApplicationPanelRestPayload = buildApplicationPanelRestPayload;
exports.sendApplicationPanel = sendApplicationPanel;
exports.recentApplications = recentApplications;
exports.applicationById = applicationById;
exports.applicationCooldown = applicationCooldown;
exports.showApplicationModal = showApplicationModal;
exports.submitApplication = submitApplication;
exports.reviewApplication = reviewApplication;
const discord_js_1 = require("discord.js");
const db_js_1 = require("../db.js");
const core_js_1 = require("../lib/core.js");
function applicationColor(cfg) {
    const raw = cfg.embeds?.supportColor ?? cfg.brand?.primary ?? 0x7C6CF5;
    if (typeof raw === 'string') {
        const cleaned = raw.trim().replace(/^#/, '').replace(/^0x/i, '');
        const parsed = Number.parseInt(cleaned, 16);
        return Number.isFinite(parsed) ? parsed : 0x7C6CF5;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0x7C6CF5;
}
function schema(guildId, type) {
    const form = (0, db_js_1.getGuildConfig)(guildId).applicationDefaults.forms?.[type];
    if (!form)
        return null;
    return { ...form, questions: (form.questions ?? []).slice(0, 5) };
}
function resolvePanelConfig(guildId, panelId = 'default') {
    const cfg = (0, db_js_1.getGuildConfig)(guildId);
    const forms = cfg.applicationDefaults?.forms ?? {};
    const sets = cfg.applicationDefaults?.panelSets ?? {};
    const panel = sets[panelId] || (panelId === 'default' ? {
        id: 'default', name: 'Default applications',
        title: cfg.panels?.applications?.title || 'Applications',
        description: cfg.panels?.applications?.description || 'Choose an application type below to open the form.',
        formIds: Object.keys(forms).slice(0, 25)
    } : null);
    if (!panel)
        throw new Error(`Application panel “${panelId}” was not found. Configure it in Dashboard → Applications.`);
    const ids = Array.isArray(panel.formIds) && panel.formIds.length
        ? panel.formIds.map(String)
        : Object.keys(forms);
    const choices = ids.map(id => [id, forms[id]]).filter(([id, form]) => /^[a-z0-9_-]{1,40}$/i.test(id) && form?.title).slice(0, 25);
    if (!choices.length)
        throw new Error(`Application panel “${panel.name || panel.id || panelId}” has no configured forms. Select one to 25 forms in Dashboard → Applications.`);
    return { cfg, panel, choices };
}
function buildApplicationPanelRestPayload(guildId, panelId = 'default') {
    const { cfg, panel, choices } = resolvePanelConfig(guildId, panelId);
    const components = [];
    for (let offset = 0; offset < choices.length; offset += 5) {
        components.push({
            type: 1,
            components: choices.slice(offset, offset + 5).map(([type, form], index) => ({
                type: 2,
                style: ({ PRIMARY: 1, SECONDARY: 2, SUCCESS: 3, DANGER: 4 })[String(form.buttonStyle || (type === 'partner' ? 'SECONDARY' : type === 'creator' ? 'SUCCESS' : 'PRIMARY')).toUpperCase()] || 1,
                label: String(form.buttonLabel || form.title || type).slice(0, 80),
                ...(String(form.buttonEmoji || '').trim() ? { emoji: { name: String(form.buttonEmoji).trim().slice(0, 16) } } : {}),
                custom_id: `application:create:${type}`
            }))
        });
    }
    return {
        embeds: [{
                title: String(panel.title || cfg.panels?.applications?.title || 'Applications').slice(0, 256),
                description: String(panel.description || cfg.panels?.applications?.description || 'Choose an application type below to open the form.').slice(0, 4096),
                color: applicationColor(cfg)
            }],
        components,
        allowed_mentions: { parse: [] }
    };
}
function sendApplicationPanel(channel, guildId, panelId = 'default') {
    const { cfg, panel, choices } = resolvePanelConfig(guildId, panelId);
    const rows = [];
    for (let offset = 0; offset < choices.length; offset += 5) {
        rows.push(new discord_js_1.ActionRowBuilder().addComponents(choices.slice(offset, offset + 5).map(([type, form]) => {
            const styleName = String(form.buttonStyle || (type === 'partner' ? 'SECONDARY' : type === 'creator' ? 'SUCCESS' : 'PRIMARY')).toUpperCase();
            const style = ({ PRIMARY: discord_js_1.ButtonStyle.Primary, SECONDARY: discord_js_1.ButtonStyle.Secondary, SUCCESS: discord_js_1.ButtonStyle.Success, DANGER: discord_js_1.ButtonStyle.Danger })[styleName] || discord_js_1.ButtonStyle.Primary;
            const button = new discord_js_1.ButtonBuilder().setCustomId(`application:create:${type}`).setLabel(String(form.buttonLabel || form.title || type).slice(0, 80)).setStyle(style);
            if (String(form.buttonEmoji || '').trim())
                button.setEmoji(String(form.buttonEmoji).trim().slice(0, 16));
            return button;
        })));
    }
    return channel.send({
        embeds: [(0, core_js_1.makeEmbed)({
                title: String(panel.title || cfg.panels?.applications?.title || 'Applications').slice(0, 256),
                description: String(panel.description || cfg.panels?.applications?.description || 'Choose an application type below to open the form.').slice(0, 4096),
                color: applicationColor(cfg)
            })],
        components: rows,
        allowedMentions: { parse: [] }
    });
}
function recentApplications(guildId, status = 'all', limit = 25) {
    if (status === 'all')
        return db_js_1.db.prepare('SELECT * FROM applications WHERE guild_id=? ORDER BY created_at DESC LIMIT ?').all(guildId, limit);
    return db_js_1.db.prepare('SELECT * FROM applications WHERE guild_id=? AND status=? ORDER BY created_at DESC LIMIT ?').all(guildId, status, limit);
}
function applicationById(guildId, id) {
    return db_js_1.db.prepare('SELECT * FROM applications WHERE guild_id=? AND id=?').get(guildId, id);
}
function applicationCooldown(guildId, userId, hours) {
    const row = db_js_1.db.prepare('SELECT created_at FROM applications WHERE guild_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1').get(guildId, userId);
    if (!row)
        return 0;
    return Math.max(0, row.created_at + hours * 3600000 - Date.now());
}
async function showApplicationModal(interaction, type, modalFactory) {
    const cfg = (0, db_js_1.getGuildConfig)(interaction.guildId);
    if (cfg.applicationDefaults?.enabled === false || cfg.modules?.applications === false) {
        return (0, core_js_1.safeReply)(interaction, { content: 'Applications are currently disabled in this server. Please contact the server staff.', ephemeral: true });
    }
    const form = schema(interaction.guildId, type);
    if (!form)
        return (0, core_js_1.safeReply)(interaction, { content: 'That application type is not configured.', ephemeral: true });
    const wait = applicationCooldown(interaction.guildId, interaction.user.id, (0, db_js_1.getGuildConfig)(interaction.guildId).applicationDefaults.cooldownHours);
    if (wait > 0)
        return (0, core_js_1.safeReply)(interaction, { content: `You can apply again in <t:${Math.ceil((Date.now() + wait) / 1000)}:R>.`, ephemeral: true });
    const fields = form.questions.map((question, index) => ({
        id: `q${index}`,
        label: (0, core_js_1.truncate)(String(question), 45),
        required: true,
        style: 2,
        minLength: 1,
        maxLength: index === 0 ? 100 : 1000,
        placeholder: 'Your answer'
    }));
    await interaction.showModal(modalFactory(`application:submit:${type}`, form.title?.slice(0, 45) ?? 'Application', fields));
    const now = Date.now();
    db_js_1.db.prepare(`INSERT INTO application_drafts(guild_id,user_id,type,opened_at,expires_at) VALUES(?,?,?,?,?)
    ON CONFLICT(guild_id,user_id,type) DO UPDATE SET opened_at=excluded.opened_at,expires_at=excluded.expires_at`)
        .run(String(interaction.guildId), String(interaction.user.id), String(type), now, now + 15 * 60 * 1000);
}
async function submitApplication(interaction, client, type) {
    const cfg = (0, db_js_1.getGuildConfig)(interaction.guildId);
    if (cfg.applicationDefaults?.enabled === false || cfg.modules?.applications === false) {
        return (0, core_js_1.safeReply)(interaction, { content: 'Applications are currently disabled in this server. Please contact the server staff.', ephemeral: true });
    }
    const form = schema(interaction.guildId, type);
    if (!form)
        return (0, core_js_1.safeReply)(interaction, { content: 'That application type is not configured.', ephemeral: true });
    const wait = applicationCooldown(interaction.guildId, interaction.user.id, cfg.applicationDefaults.cooldownHours);
    if (wait > 0)
        return (0, core_js_1.safeReply)(interaction, { content: `You can apply again in <t:${Math.ceil((Date.now() + wait) / 1000)}:R>.`, ephemeral: true });
    const answers = form.questions.map((question, index) => ({ question, answer: interaction.fields.getTextInputValue(`q${index}`) }));
    db_js_1.db.prepare('DELETE FROM application_drafts WHERE guild_id=? AND user_id=? AND type=?').run(String(interaction.guildId), String(interaction.user.id), String(type));
    const result = db_js_1.db.prepare('INSERT INTO applications(guild_id,user_id,type,answers,status,created_at) VALUES(?,?,?,?,?,?)').run(interaction.guildId, interaction.user.id, type, JSON.stringify(answers), 'pending', Date.now());
    const id = Number(result.lastInsertRowid);
    const reviewChannelId = cfg.applicationDefaults.reviewChannelId ?? cfg.applicationDefaults.channelId;
    const reviewChannel = reviewChannelId ? interaction.guild.channels.cache.get(reviewChannelId) : null;
    const description = answers.map((a, i) => `**${i + 1}. ${a.question}**\n${(0, core_js_1.truncate)(a.answer, 700)}`).join('\n\n');
    if (reviewChannel?.isTextBased()) {
        await reviewChannel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: `${form.title} — #${id}`, description: `${interaction.user} — \`${interaction.user.id}\`\n\n${description}`, color: cfg.embeds.supportColor })] }).catch(() => { });
    }
    const logSettings = cfg.loggingDefaults || {};
    const applicationLogId = logSettings.channels?.applications;
    if (logSettings.enabled !== false && logSettings.events?.applications !== false && applicationLogId && String(applicationLogId) !== String(reviewChannelId)) {
        const logTarget = interaction.guild.channels.cache.get(String(applicationLogId));
        if (logTarget?.isTextBased())
            await logTarget.send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Application submitted', description: `Case: **#${id}**\nApplicant: ${interaction.user} (\`${interaction.user.id}\`)\nForm: **${form.title || type}**\nReview status: **Pending**`, color: cfg.embeds.infoColor || cfg.embeds.supportColor })] }).catch(() => { });
    }
    if (cfg.applicationDefaults.dmOnSubmission !== false && cfg.dmTemplates.applicationReceived)
        await (0, core_js_1.dmTemplate)(interaction.user, interaction.guild, cfg.dmTemplates.applicationReceived, { type: form.title ?? type });
    await (0, core_js_1.safeReply)(interaction, { content: `${cfg.messagesExtended.application.submitted} Case #${id}.`, ephemeral: true });
    return id;
}
async function reviewApplication(client, guildId, id, status, reviewer, reason = '') {
    const normalizedStatus = String(status || '').toLowerCase();
    if (!['accepted', 'rejected', 'reviewing'].includes(normalizedStatus))
        throw new Error('Choose reviewing, accepted or rejected.');
    const row = applicationById(guildId, id);
    if (!row)
        throw new Error('Application not found.');
    if (!['pending', 'reviewing'].includes(row.status))
        throw new Error(`That application has already been ${row.status}.`);
    db_js_1.db.prepare('UPDATE applications SET status=?,reviewer_id=?,review_reason=? WHERE guild_id=? AND id=?').run(normalizedStatus, reviewer.id, reason, guildId, id);
    const guild = client.guilds.cache.get(guildId);
    const cfg = (0, db_js_1.getGuildConfig)(guildId);
    let dmSent = false;
    if (['accepted', 'rejected'].includes(normalizedStatus) && cfg.applicationDefaults?.dmOnDecision !== false) {
        const user = await client.users.fetch(row.user_id).catch(() => null);
        if (user) {
            const template = normalizedStatus === 'accepted' ? cfg.dmTemplates.applicationAccepted : cfg.dmTemplates.applicationRejected;
            const form = cfg.applicationDefaults?.forms?.[row.type] || {};
            dmSent = await (0, core_js_1.dmTemplate)(user, guild, template, { type: form.title || row.type, applicationId: String(id), reason: reason || 'No reason provided.', moderator: reviewer.tag || reviewer.username || reviewer.id });
        }
    }
    const logSettings = cfg.loggingDefaults || {};
    const logChannelId = logSettings.channels?.applications;
    if (logSettings.enabled !== false && logSettings.events?.applications !== false && logChannelId && guild) {
        const logChannel = guild.channels.cache.get(String(logChannelId));
        if (logChannel?.isTextBased()) {
            const form = cfg.applicationDefaults?.forms?.[row.type] || {};
            await logChannel.send({ embeds: [(0, core_js_1.makeEmbed)({
                        title: `Application ${normalizedStatus}`,
                        description: `Case: **#${id}**\nApplicant: <@${row.user_id}> (\`${row.user_id}\`)\nForm: **${form.title || row.type}**\nReviewed by: ${reviewer.tag || reviewer.username || reviewer.id}\nReason: ${reason || 'No reason provided.'}\nMember DM: **${['accepted', 'rejected'].includes(normalizedStatus) ? (cfg.applicationDefaults?.dmOnDecision === false ? 'Disabled in settings' : dmSent ? 'Delivered' : 'Could not be delivered') : 'Not applicable'}**`,
                        color: normalizedStatus === 'accepted' ? 0x39C98A : normalizedStatus === 'rejected' ? 0xEF355D : 0x60A9FF
                    })], allowedMentions: { parse: [] } }).catch(() => { });
        }
    }
    return { ...row, status: normalizedStatus, dmSent };
}

});
__factories.set("src/systems/community.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStickyMessage = handleStickyMessage;
exports.setSticky = setSticky;
exports.removeSticky = removeSticky;
exports.listSticky = listSticky;
exports.imageOnlyEnabled = imageOnlyEnabled;
exports.toggleImageOnly = toggleImageOnly;
exports.imageOnlyList = imageOnlyList;
exports.addAutorole = addAutorole;
exports.removeAutorole = removeAutorole;
exports.resetAutoroles = resetAutoroles;
exports.listAutoroles = listAutoroles;
exports.levelForXp = levelForXp;
exports.xpRequiredForLevel = xpRequiredForLevel;
exports.addXp = addXp;
exports.levelData = levelData;
exports.levelLeaderboard = levelLeaderboard;
exports.setLevel = setLevel;
exports.setXp = setXp;
exports.resetLevel = resetLevel;
exports.addCounter = addCounter;
exports.removeCounter = removeCounter;
exports.listCounters = listCounters;
exports.refreshCounters = refreshCounters;
exports.createPollButtons = createPollButtons;
exports.addSuggestion = addSuggestion;
exports.suggestion = suggestion;
exports.updateSuggestion = updateSuggestion;
exports.setBirthday = setBirthday;
exports.getBirthday = getBirthday;
exports.birthdays = birthdays;
exports.setTimezone = setTimezone;
exports.getTimezone = getTimezone;
exports.parseColorHex = parseColorHex;
exports.jokeScore = jokeScore;
exports.dice = dice;
exports.coinflip = coinflip;
exports.dailyNextAt = dailyNextAt;
const discord_js_1 = require("discord.js");
const db_js_1 = require("../db.js");
const core_js_1 = require("../lib/core.js");
async function handleStickyMessage(message) {
    const row = db_js_1.db.prepare('SELECT * FROM sticky WHERE guild_id=? AND channel_id=?').get(message.guild.id, message.channel.id);
    if (!row || message.author.bot)
        return;
    if (!(0, db_js_1.getGuildConfig)(message.guild.id).stickyDefaults.repostOnNewMessage)
        return;
    const channel = message.channel;
    const old = row.message_id ? await channel.messages.fetch(row.message_id).catch(() => null) : null;
    if (old)
        await old.delete().catch(() => { });
    const sent = await channel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Pinned', description: row.content, color: (0, db_js_1.getGuildConfig)(message.guild.id).brand?.primary ?? 0x8b7cff })] }).catch(() => null);
    if (sent)
        db_js_1.db.prepare('UPDATE sticky SET message_id=?,updated_at=? WHERE guild_id=? AND channel_id=?').run(sent.id, Date.now(), message.guild.id, message.channel.id);
}
async function setSticky(guildId, channelId, content) {
    db_js_1.db.prepare('INSERT INTO sticky(guild_id,channel_id,message_id,content,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(channel_id) DO UPDATE SET message_id=NULL, content=excluded.content, updated_at=excluded.updated_at').run(guildId, channelId, null, content, Date.now());
}
function removeSticky(guildId, channelId) { db_js_1.db.prepare('DELETE FROM sticky WHERE guild_id=? AND channel_id=?').run(guildId, channelId); }
function listSticky(guildId) { return db_js_1.db.prepare('SELECT * FROM sticky WHERE guild_id=?').all(guildId); }
function imageOnlyEnabled(guildId, channelId) { return Boolean(db_js_1.db.prepare('SELECT 1 FROM image_only WHERE guild_id=? AND channel_id=?').get(guildId, channelId)); }
function toggleImageOnly(guildId, channelId, enabled) {
    if (enabled)
        db_js_1.db.prepare('INSERT OR IGNORE INTO image_only(guild_id,channel_id) VALUES(?,?)').run(guildId, channelId);
    else
        db_js_1.db.prepare('DELETE FROM image_only WHERE guild_id=? AND channel_id=?').run(guildId, channelId);
}
function imageOnlyList(guildId) { return db_js_1.db.prepare('SELECT * FROM image_only WHERE guild_id=?').all(guildId); }
function addAutorole(guildId, roleId) { db_js_1.db.prepare('INSERT OR IGNORE INTO autoroles(guild_id,role_id) VALUES(?,?)').run(guildId, roleId); }
function removeAutorole(guildId, roleId) { db_js_1.db.prepare('DELETE FROM autoroles WHERE guild_id=? AND role_id=?').run(guildId, roleId); }
function resetAutoroles(guildId) { db_js_1.db.prepare('DELETE FROM autoroles WHERE guild_id=?').run(guildId); }
function listAutoroles(guildId) { return db_js_1.db.prepare('SELECT role_id FROM autoroles WHERE guild_id=?').all(guildId).map(x => x.role_id); }
function levelForXp(xp, base = 100, multiplier = 50) {
    let level = 0, need = base;
    while (xp >= need && level < 1000) {
        xp -= need;
        level++;
        need += multiplier;
    }
    return level;
}
function xpRequiredForLevel(level, base = 100, multiplier = 50) { return level * base + multiplier * ((level - 1) * level / 2); }
function addXp(guildId, userId, amount, cfg) {
    const current = db_js_1.db.prepare('SELECT * FROM levels WHERE guild_id=? AND user_id=?').get(guildId, userId) ?? { xp: 0, level: 0 };
    const xp = current.xp + amount;
    const level = levelForXp(xp, cfg.levelDefaults.levelFormulaBase, cfg.levelDefaults.levelFormulaMultiplier);
    db_js_1.db.prepare('INSERT INTO levels(guild_id,user_id,xp,level) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET xp=excluded.xp,level=excluded.level').run(guildId, userId, xp, level);
    return { ...current, xp, level, levelUp: level > current.level };
}
function levelData(guildId, userId) { return db_js_1.db.prepare('SELECT * FROM levels WHERE guild_id=? AND user_id=?').get(guildId, userId) ?? { xp: 0, level: 0 }; }
function levelLeaderboard(guildId, limit = 10) { return db_js_1.db.prepare('SELECT * FROM levels WHERE guild_id=? ORDER BY xp DESC LIMIT ?').all(guildId, limit); }
function setLevel(guildId, userId, level, cfg) { const xp = xpRequiredForLevel(level, cfg.levelDefaults.levelFormulaBase, cfg.levelDefaults.levelFormulaMultiplier); db_js_1.db.prepare('INSERT INTO levels(guild_id,user_id,xp,level) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET xp=excluded.xp,level=excluded.level').run(guildId, userId, xp, level); }
function setXp(guildId, userId, xp, cfg) { const level = levelForXp(xp, cfg.levelDefaults.levelFormulaBase, cfg.levelDefaults.levelFormulaMultiplier); db_js_1.db.prepare('INSERT INTO levels(guild_id,user_id,xp,level) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET xp=excluded.xp,level=excluded.level').run(guildId, userId, xp, level); }
function resetLevel(guildId, userId) { db_js_1.db.prepare('DELETE FROM levels WHERE guild_id=? AND user_id=?').run(guildId, userId); }
function addCounter(guildId, channelId, metric) { db_js_1.db.prepare('INSERT OR REPLACE INTO counters(guild_id,channel_id,metric) VALUES(?,?,?)').run(guildId, channelId, metric); }
function removeCounter(channelId) { db_js_1.db.prepare('DELETE FROM counters WHERE channel_id=?').run(channelId); }
function listCounters(guildId) { return db_js_1.db.prepare('SELECT * FROM counters WHERE guild_id=?').all(guildId); }
async function refreshCounters(guild) {
    const cfg = (0, db_js_1.getGuildConfig)(guild.id);
    for (const row of listCounters(guild.id)) {
        const channel = guild.channels.cache.get(row.channel_id);
        if (!channel)
            continue;
        let count = 0;
        switch (row.metric) {
            case 'members':
                count = guild.memberCount;
                break;
            case 'humans':
                count = guild.members.cache.filter(m => !m.user.bot).size;
                break;
            case 'bots':
                count = guild.members.cache.filter(m => m.user.bot).size;
                break;
            case 'boosts':
                count = guild.premiumSubscriptionCount ?? 0;
                break;
            case 'roles':
                count = guild.roles.cache.size;
                break;
            case 'channels':
                count = guild.channels.cache.size;
                break;
            case 'voice':
                count = guild.members.cache.filter(m => m.voice.channel).size;
                break;
            case 'text':
                count = guild.channels.cache.filter(c => c.isTextBased()).size;
                break;
            default: continue;
        }
        const prefix = cfg.counterDefaults.prefixes[row.metric] ?? `${row.metric}: `;
        await channel.setName(`${prefix}${count}`.slice(0, 100)).catch(() => { });
    }
}
function createPollButtons(options) {
    return new discord_js_1.ActionRowBuilder().addComponents(options.map((_, i) => new discord_js_1.ButtonBuilder().setCustomId(`poll:${i}`).setLabel(String.fromCharCode(65 + i)).setStyle(discord_js_1.ButtonStyle.Secondary)));
}
function addSuggestion(guildId, userId, text) { const r = db_js_1.db.prepare('INSERT INTO suggestions(guild_id,user_id,text,created_at) VALUES(?,?,?,?)').run(guildId, userId, text, Date.now()); return Number(r.lastInsertRowid); }
function suggestion(id, guildId) { return db_js_1.db.prepare('SELECT * FROM suggestions WHERE id=? AND guild_id=?').get(id, guildId); }
function updateSuggestion(id, guildId, status, reason = '') { db_js_1.db.prepare('UPDATE suggestions SET status=?,reason=? WHERE id=? AND guild_id=?').run(status, reason, id, guildId); }
function setBirthday(guildId, userId, month, day) { db_js_1.db.prepare('INSERT OR REPLACE INTO birthdays(guild_id,user_id,month,day) VALUES(?,?,?,?)').run(guildId, userId, month, day); }
function getBirthday(guildId, userId) { return db_js_1.db.prepare('SELECT * FROM birthdays WHERE guild_id=? AND user_id=?').get(guildId, userId); }
function birthdays(guildId) { return db_js_1.db.prepare('SELECT * FROM birthdays WHERE guild_id=? ORDER BY month,day').all(guildId); }
function setTimezone(userId, timezone) { db_js_1.db.prepare('INSERT OR REPLACE INTO timezones(user_id,timezone) VALUES(?,?)').run(userId, timezone); }
function getTimezone(userId) { return db_js_1.db.prepare('SELECT timezone FROM timezones WHERE user_id=?').get(userId)?.timezone ?? 'UTC'; }
function parseColorHex(input) { const value = (0, core_js_1.safeHexColor)(input, null); if (value === null)
    throw new Error('Use a valid hex color such as `#8B7CFF`.'); return value; }
function jokeScore(label, userId) { return (0, core_js_1.hashNumber)(`${label}:${userId}`, 101); }
function dice(sides = 6, count = 1) { sides = Math.min(1000, Math.max(2, Number(sides) || 6)); count = Math.min(20, Math.max(1, Number(count) || 1)); let total = 0; const rolls = []; for (let i = 0; i < count; i++) {
    const v = (0, core_js_1.randomBetween)(1, sides);
    rolls.push(v);
    total += v;
} return { rolls, total }; }
function coinflip() { return Math.random() < 0.5 ? 'Heads' : 'Tails'; }
function dailyNextAt() { return Date.now() + 86400000; }

});
__factories.set("src/systems/giveaways.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGiveawayConstraints = parseGiveawayConstraints;
exports.activeGiveaways = activeGiveaways;
exports.giveaway = giveaway;
exports.giveawayEntries = giveawayEntries;
exports.giveawayEntryCount = giveawayEntryCount;
exports.enterGiveaway = enterGiveaway;
exports.leaveGiveaway = leaveGiveaway;
exports.markGiveaway = markGiveaway;
exports.editGiveawayField = editGiveawayField;
exports.pickWinners = pickWinners;
exports.buildGiveawayPayload = buildGiveawayPayload;
exports.startGiveaway = startGiveaway;
exports.finishGiveaway = finishGiveaway;
exports.rerollGiveaway = rerollGiveaway;
exports.updateGiveawayMessage = updateGiveawayMessage;
const discord_js_1 = require("discord.js");
const db_js_1 = require("../db.js");
const core_js_1 = require("../lib/core.js");
function ensureGiveawayColumns() {
    const columns = new Set(db_js_1.db.prepare('PRAGMA table_info(giveaways)').all().map(column => column.name));
    if (!columns.has('title'))
        db_js_1.db.exec("ALTER TABLE giveaways ADD COLUMN title TEXT NOT NULL DEFAULT 'Giveaway'");
    if (!columns.has('winner_ids'))
        db_js_1.db.exec("ALTER TABLE giveaways ADD COLUMN winner_ids TEXT NOT NULL DEFAULT '[]'");
}
ensureGiveawayColumns();
const text = (value, fallback) => String(value ?? '').trim() || fallback;
const parseIds = value => {
    if (Array.isArray(value))
        return value.map(String);
    try {
        const parsed = JSON.parse(String(value ?? '[]'));
        return Array.isArray(parsed) ? parsed.map(String) : [];
    }
    catch {
        return [];
    }
};
function parseGiveawayConstraints(guildId) {
    const cfg = (0, db_js_1.getGuildConfig)(guildId).giveawayDefaults;
    return {
        minAccountAgeDays: Math.max(0, Number(cfg.minAccountAgeDays ?? 0)),
        minServerAgeDays: Math.max(0, Number(cfg.minServerAgeDays ?? cfg.minimumServerAgeDays ?? 0)),
        requiredRoleIds: Array.isArray(cfg.requiredRoleIds) ? cfg.requiredRoleIds.map(String) : []
    };
}
function activeGiveaways(guildId) {
    return db_js_1.db.prepare("SELECT * FROM giveaways WHERE guild_id=? AND status='active' ORDER BY end_at").all(String(guildId));
}
function giveaway(id) { return db_js_1.db.prepare('SELECT * FROM giveaways WHERE message_id=?').get(String(id)); }
function giveawayEntries(messageId) {
    return db_js_1.db.prepare('SELECT user_id FROM giveaway_entries WHERE message_id=? ORDER BY created_at').all(String(messageId)).map(row => row.user_id);
}
function giveawayEntryCount(messageId) {
    return Number(db_js_1.db.prepare('SELECT COUNT(*) AS count FROM giveaway_entries WHERE message_id=?').get(String(messageId))?.count ?? 0);
}
function enterGiveaway(messageId, userId) {
    const result = db_js_1.db.prepare('INSERT OR IGNORE INTO giveaway_entries(message_id,user_id,created_at) VALUES(?,?,?)').run(String(messageId), String(userId), Date.now());
    return result.changes > 0;
}
function leaveGiveaway(messageId, userId) {
    return db_js_1.db.prepare('DELETE FROM giveaway_entries WHERE message_id=? AND user_id=?').run(String(messageId), String(userId)).changes > 0;
}
function markGiveaway(messageId, status) {
    db_js_1.db.prepare('UPDATE giveaways SET status=? WHERE message_id=?').run(String(status), String(messageId));
}
function editGiveawayField(messageId, field, value) {
    const allowed = new Set(['title', 'prize', 'description', 'winners', 'end_at', 'color', 'constraints']);
    if (!allowed.has(field))
        return false;
    db_js_1.db.prepare(`UPDATE giveaways SET ${field}=? WHERE message_id=?`).run(value, String(messageId));
    return true;
}
function pickWinners(ids, count) {
    const pool = [...new Set(ids.map(String))];
    const winners = [];
    const winnerCount = Math.max(0, Math.min(25, Number(count) || 0));
    while (pool.length && winners.length < winnerCount) {
        const index = (0, core_js_1.randomBetween)(0, pool.length - 1);
        winners.push(pool.splice(index, 1)[0]);
    }
    return winners;
}
function buildGiveawayPayload(row, { state = row.status, winnerIds = null } = {}) {
    const cfg = (0, db_js_1.getGuildConfig)(String(row.guild_id));
    const defaults = cfg.giveawayDefaults ?? {};
    const isActive = state === 'active';
    const isCancelled = state === 'cancelled';
    const winners = winnerIds ?? parseIds(row.winner_ids);
    const entries = giveawayEntryCount(row.message_id);
    const title = isCancelled
        ? text(defaults.cancelledTitle, 'Giveaway Cancelled')
        : isActive ? text(row.title, text(defaults.title, 'Giveaway')) : text(defaults.endedTitle, 'Giveaway Ended');
    const description = text(row.description, text(defaults.description, 'Click below to enter.'));
    const fields = [
        { name: text(defaults.prizeLabel, 'Prize'), value: (0, core_js_1.truncate)(String(row.prize || 'Unspecified prize'), 1024), inline: false },
        { name: text(defaults.winnersLabel, 'Winners'), value: isActive ? `**${Number(row.winners) || 1}**` : (winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'No winners.'), inline: true },
        { name: text(defaults.entriesLabel, 'Entries'), value: `**${entries}**`, inline: true },
        { name: text(defaults.endsLabel, 'Ends'), value: isActive ? `<t:${Math.floor(Number(row.end_at) / 1000)}:R>` : `<t:${Math.floor(Number(row.end_at) / 1000)}:f>`, inline: true },
        { name: text(defaults.hostLabel, 'Hosted by'), value: `<@${row.host_id}>`, inline: true }
    ];
    const embed = (0, core_js_1.makeEmbed)({
        title,
        description: isActive ? description : `${description}\n\n${isCancelled ? 'This giveaway was cancelled.' : (winners.length ? `**${text(defaults.winnersLabel, 'Winners')}**\n${winners.map(id => `<@${id}>`).join(', ')}` : 'No eligible entrants were available to win.')}`,
        fields,
        color: Number(row.color ?? defaults.defaultColor) || 0x7C6CF5,
        timestamp: false
    });
    const label = text(isActive ? defaults.entryButtonLabel : defaults.endedButtonLabel, isActive ? 'Enter Giveaway' : 'Ended').slice(0, 80);
    const button = new discord_js_1.ButtonBuilder().setCustomId('giveaway:enter').setLabel(label).setStyle(isActive ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary).setDisabled(!isActive);
    return { embeds: [embed], components: [new discord_js_1.ActionRowBuilder().addComponents(button)], allowedMentions: { parse: [] } };
}
async function startGiveaway(channel, host, durationMs, winners, prize, options = {}) {
    const guildId = String(channel.guild.id);
    const cfg = (0, db_js_1.getGuildConfig)(guildId);
    if (cfg.modules?.giveaways === false || cfg.giveawayDefaults?.enabled === false)
        throw new Error('Giveaways are disabled for this server. Enable them in the Dashboard first.');
    if (!channel?.isTextBased?.() || !channel.guild)
        throw new Error('Choose a text channel in this server.');
    const endAt = Date.now() + durationMs;
    const configuredColor = options.color ?? cfg.giveawayDefaults.defaultColor ?? 0x7C6CF5;
    const color = typeof configuredColor === 'string' && configuredColor.trim().startsWith('#') ? (0, core_js_1.safeHexColor)(configuredColor, 0x7C6CF5) : (Number(configuredColor) || 0x7C6CF5);
    const title = (0, core_js_1.truncate)(text(options.title, text(cfg.giveawayDefaults.title, 'Giveaway')), 256);
    const description = (0, core_js_1.truncate)(text(options.description, text(cfg.giveawayDefaults.description, 'Click below to enter.')), 3900);
    const constraints = { ...parseGiveawayConstraints(guildId), ...(options.constraints ?? {}) };
    const row = { guild_id: guildId, message_id: '', channel_id: channel.id, prize, description, winners, end_at: endAt, host_id: host.id, color, status: 'active', title, winner_ids: '[]' };
    const message = await channel.send(buildGiveawayPayload(row, { state: 'active', winnerIds: [] }));
    try {
        db_js_1.db.prepare('INSERT INTO giveaways(message_id,guild_id,channel_id,prize,description,winners,end_at,host_id,color,constraints,title,winner_ids) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
            .run(message.id, guildId, channel.id, (0, core_js_1.truncate)(prize, 250), description, winners, endAt, host.id, color, JSON.stringify(constraints), title, '[]');
    }
    catch (error) {
        await message.delete().catch(() => { });
        throw error;
    }
    return message;
}
function winnerAnnouncement(defaults, row, winners) {
    const template = text(defaults.winnerMessage, 'Congratulations {users}! You won **{prize}**.');
    return template
        .replaceAll('{users}', winners.map(id => `<@${id}>`).join(', '))
        .replaceAll('{prize}', String(row.prize))
        .replaceAll('{count}', String(winners.length))
        .replaceAll('{host}', `<@${row.host_id}>`)
        .replaceAll('{entries}', String(giveawayEntryCount(row.message_id)));
}
async function fetchGiveawayMessage(client, row) {
    let channel = client.channels.cache.get(String(row.channel_id));
    if (!channel)
        channel = await client.channels.fetch(String(row.channel_id)).catch(() => null);
    if (!channel?.isTextBased?.())
        return { channel: null, message: null };
    const message = await channel.messages.fetch(String(row.message_id)).catch(() => null);
    return { channel, message };
}
async function finishGiveaway(client, row, mode = 'end') {
    if (!row || row.status !== 'active')
        return null;
    const entries = giveawayEntries(row.message_id);
    const winners = mode === 'cancel' ? [] : pickWinners(entries, row.winners);
    const status = mode === 'cancel' ? 'cancelled' : 'ended';
    db_js_1.db.prepare('UPDATE giveaways SET status=?,winner_ids=? WHERE message_id=? AND status=\'active\'').run(status, JSON.stringify(winners), String(row.message_id));
    const updated = { ...row, status, winner_ids: JSON.stringify(winners) };
    const { channel, message } = await fetchGiveawayMessage(client, row);
    if (message)
        await message.edit(buildGiveawayPayload(updated, { state: status, winnerIds: winners })).catch(error => console.warn(`[Auralis] could not update giveaway ${row.message_id}: ${error?.message ?? error}`));
    if (channel && winners.length) {
        const defaults = (0, db_js_1.getGuildConfig)(String(row.guild_id)).giveawayDefaults ?? {};
        await channel.send({ content: winnerAnnouncement(defaults, row, winners), allowedMentions: { users: winners } })
            .catch(error => console.warn(`[Auralis] could not announce giveaway winners ${row.message_id}: ${error?.message ?? error}`));
    }
    return winners;
}
async function rerollGiveaway(client, row, winnerCount = null) {
    if (!row || row.status !== 'ended')
        throw new Error('Only an ended giveaway can be rerolled.');
    const entries = giveawayEntries(row.message_id);
    const previousWinners = row.status === 'ended' ? parseIds(row.winner_ids) : [];
    const eligible = entries.filter(id => !previousWinners.includes(id));
    if (!eligible.length)
        throw new Error('There are no new eligible entrants available for a reroll.');
    const winners = pickWinners(eligible, winnerCount ?? row.winners);
    if (!winners.length)
        throw new Error('No winner could be selected.');
    db_js_1.db.prepare('UPDATE giveaways SET status=\'ended\',winner_ids=? WHERE message_id=?').run(JSON.stringify(winners), String(row.message_id));
    const updated = { ...row, status: 'ended', winner_ids: JSON.stringify(winners) };
    const { channel, message } = await fetchGiveawayMessage(client, row);
    if (message)
        await message.edit(buildGiveawayPayload(updated, { state: 'ended', winnerIds: winners })).catch(error => console.warn(`[Auralis] could not update rerolled giveaway ${row.message_id}: ${error?.message ?? error}`));
    if (channel) {
        const defaults = (0, db_js_1.getGuildConfig)(String(row.guild_id)).giveawayDefaults ?? {};
        await channel.send({ content: winnerAnnouncement(defaults, row, winners), allowedMentions: { users: winners } })
            .catch(error => console.warn(`[Auralis] could not announce rerolled giveaway ${row.message_id}: ${error?.message ?? error}`));
    }
    return winners;
}
async function updateGiveawayMessage(client, row) {
    const { message } = await fetchGiveawayMessage(client, row);
    if (!message)
        return false;
    await message.edit(buildGiveawayPayload(row, { state: row.status, winnerIds: parseIds(row.winner_ids) }));
    return true;
}

});
__factories.set("src/systems/invites.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureManagedInvite = ensureManagedInvite;
exports.handleManagedInviteDelete = handleManagedInviteDelete;
exports.removeManagedInviteForGuild = removeManagedInviteForGuild;
exports.refreshManagedInvites = refreshManagedInvites;
const discord_js_1 = require("discord.js");
const db_js_1 = require("../db.js");
const db_js_2 = require("../db.js");
function candidateChannels(guild) {
    const cfg = (0, db_js_1.getGuildConfig)(guild.id);
    const configured = cfg.publicDirectory?.inviteChannelId;
    const list = [];
    if (configured) {
        const channel = guild.channels.cache.get(configured);
        if (channel)
            list.push(channel);
    }
    if (guild.systemChannel && !list.includes(guild.systemChannel))
        list.push(guild.systemChannel);
    const rest = guild.channels.cache
        .filter(channel => channel.isTextBased?.() && !channel.isThread?.())
        .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0));
    for (const channel of rest.values())
        if (!list.includes(channel))
            list.push(channel);
    return list;
}
function canCreate(channel, me) {
    if (!channel?.isTextBased?.() || channel.isThread?.())
        return false;
    const perms = channel.permissionsFor(me);
    return Boolean(perms?.has(discord_js_1.PermissionFlagsBits.ViewChannel) && perms.has(discord_js_1.PermissionFlagsBits.CreateInstantInvite));
}
async function inviteStillExists(code) {
    try {
        const response = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=false&with_expiration=true`);
        if (response.ok)
            return true;
        if (response.status === 404)
            return false;
        return null;
    }
    catch {
        return null;
    }
}
async function ensureManagedInvite(guild, { force = false } = {}) {
    if (!guild)
        return null;
    const cfg = (0, db_js_1.getGuildConfig)(guild.id);
    if (cfg.publicDirectory?.autoInvite === false)
        return (0, db_js_2.getManagedInvite)(guild.id);
    const stored = (0, db_js_2.getManagedInvite)(guild.id);
    if (stored && !force) {
        const exists = await inviteStillExists(stored.code);
        if (exists === true)
            return stored;
        if (exists === null)
            return stored;
        (0, db_js_2.removeManagedInvite)(guild.id);
    }
    const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
    if (!me)
        return null;
    for (const channel of candidateChannels(guild)) {
        if (!canCreate(channel, me))
            continue;
        const invite = await channel.createInvite({
            maxAge: 0,
            maxUses: 0,
            temporary: false,
            unique: false,
            reason: 'Auralis managed server invite'
        }).catch(() => null);
        if (!invite?.code)
            continue;
        return (0, db_js_2.setManagedInvite)(guild.id, channel.id, invite.code, invite.url);
    }
    return null;
}
async function handleManagedInviteDelete(invite) {
    if (!invite?.guildId || !invite.code)
        return null;
    const stored = (0, db_js_2.getManagedInvite)(invite.guildId);
    if (!stored || stored.code !== invite.code)
        return null;
    (0, db_js_2.removeManagedInvite)(invite.guildId);
    return ensureManagedInvite(invite.guild, { force: true });
}
function removeManagedInviteForGuild(guildId) {
    return (0, db_js_2.removeManagedInvite)(guildId);
}
async function refreshManagedInvites(client) {
    for (const guild of client.guilds.cache.values()) {
        await ensureManagedInvite(guild).catch(() => { });
    }
}

});
__factories.set("src/systems/moderation.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warn = warn;
exports.ban = ban;
exports.tempban = tempban;
exports.kick = kick;
exports.timeout = timeout;
exports.untimeout = untimeout;
exports.unban = unban;
exports.purge = purge;
exports.cleanup = cleanup;
exports.lockdownChannel = lockdownChannel;
exports.unlockChannel = unlockChannel;
exports.stripMember = stripMember;
exports.jailMember = jailMember;
exports.unjail = unjail;
exports.history = history;
exports.warnings = warnings;
exports.activeWarningCount = activeWarningCount;
exports.removeWarning = removeWarning;
exports.clearWarnings = clearWarnings;
exports.punishmentCount = punishmentCount;
exports.punishmentStats = punishmentStats;
exports.caseLog = caseLog;
exports.recentKicks = recentKicks;
exports.banlistFromCases = banlistFromCases;
exports.timeoutAll = timeoutAll;
exports.auditEntries = auditEntries;
const discord_js_1 = require("discord.js");
const db_js_1 = require("../db.js");
const config_js_1 = require("../config.js");
const core_js_1 = require("../lib/core.js");
const moderation_policy_js_1 = require("../lib/moderation-policy.js");
function reasonOrDefault(reason) { return String(reason ?? '').trim().slice(0, 450) || 'No reason provided.'; }
function permissionContext(interaction) {
    return interaction?.memberPermissions ?? interaction?.member?.permissions ?? null;
}
function isGuildOwner(interaction) {
    return String(interaction?.guild?.ownerId ?? '') === String(interaction?.user?.id ?? '');
}
function assertPermission(interaction, permission, label) {
    const permissions = permissionContext(interaction);
    if (isGuildOwner(interaction) || permissions?.has(discord_js_1.PermissionFlagsBits.Administrator) || permissions?.has(permission))
        return;
    throw new Error(`You need **${label}** or **Administrator** permission to perform this action. The server owner is always allowed.`);
}
function actorIsGuildOwner(interaction) {
    return String(interaction?.guild?.ownerId ?? '') === String(interaction?.user?.id ?? '');
}
function roleAbove(actor, target) {
    if (!actor?.roles?.highest || !target?.roles?.highest)
        return false;
    return actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}
function botRoleAbove(interaction, target) {
    const botMember = interaction?.guild?.members?.me;
    if (!botMember?.roles?.highest || !target?.roles?.highest)
        return false;
    return botMember.roles.highest.comparePositionTo(target.roles.highest) > 0;
}
async function assertTarget(interaction, target, permission, label, action) {
    assertPermission(interaction, permission, label);
    const botMember = interaction?.guild?.members?.me;
    const actorMember = interaction?.guild?.members?.cache?.get(interaction?.user?.id)
        ?? await interaction?.guild?.members?.fetch?.(interaction?.user?.id).catch(() => null);
    if (!actorIsGuildOwner(interaction) && !actorMember?.roles?.highest) {
        throw new Error('Auralis could not verify your server role hierarchy. Please try again, or ask an administrator to check the member cache and permissions.');
    }
    const canPerform = action === 'ban' ? Boolean(target?.bannable)
        : action === 'kick' ? Boolean(target?.kickable)
            : action === 'timeout' ? Boolean(target?.moderatable)
                : action === 'roles' ? Boolean(target?.manageable && botMember?.permissions?.has(discord_js_1.PermissionFlagsBits.ManageRoles))
                    : Boolean(target);
    const failure = (0, moderation_policy_js_1.moderationTargetFailure)({
        actorId: interaction?.user?.id,
        targetId: target?.id,
        guildOwnerId: interaction?.guild?.ownerId,
        botId: botMember?.id ?? interaction?.client?.user?.id,
        actorIsOwner: actorIsGuildOwner(interaction),
        actorAboveTarget: roleAbove(actorMember ?? interaction?.member, target),
        botAboveTarget: botRoleAbove(interaction, target),
        botCanAct: canPerform,
        action
    });
    if (failure)
        throw new Error(failure);
}
function removeFailedCase(id) {
    try {
        db_js_1.db.prepare('DELETE FROM cases WHERE id=?').run(id);
    }
    catch { }
}
async function warn(interaction, target, reason) {
    await assertTarget(interaction, target, discord_js_1.PermissionFlagsBits.ManageMessages, 'Manage Messages', 'warn');
    const cfg = (0, db_js_1.getGuildConfig)(interaction.guild.id);
    await target.user.createDM().catch(() => null);
    const r = reasonOrDefault(reason);
    const id = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'WARN', r);
    const warningInsert = db_js_1.db.prepare('INSERT INTO warnings(guild_id,user_id,moderator_id,reason,created_at) VALUES(?,?,?,?,?)').run(interaction.guild.id, target.id, interaction.user.id, r, Date.now());
    const warningId = Number(warningInsert.lastInsertRowid);
    const count = Number(db_js_1.db.prepare('SELECT COUNT(*) AS count FROM warnings WHERE guild_id=? AND user_id=? AND active=1').get(interaction.guild.id, target.id)?.count ?? 0);
    let automaticAction = '';
    if (cfg.moderation.thresholdEnabled) {
        const thresholds = cfg.moderation.thresholds ?? {};
        const thresholdActions = cfg.moderation.thresholdActions ?? {};
        let kind = null;
        if (count === Number(thresholds.warningsToBan))
            kind = 'ban';
        else if (count === Number(thresholds.warningsToTempban))
            kind = 'tempban';
        else if (count === Number(thresholds.warningsToKick))
            kind = 'kick';
        else if (count === Number(thresholds.warningsToTimeout))
            kind = 'timeout';
        if (kind) {
            let extraCaseId = null;
            try {
                if (kind === 'ban') {
                    if (!target.bannable)
                        throw new Error('Auralis lacks Ban Members or its role is not high enough.');
                    extraCaseId = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'BAN', `Automatic threshold reached after ${count} active warnings.`);
                    try {
                        await target.ban({ reason: `Case #${extraCaseId}: automatic warning threshold` });
                    }
                    catch (error) {
                        removeFailedCase(extraCaseId);
                        throw error;
                    }
                    automaticAction = `Automatic threshold action applied: permanent ban (case #${extraCaseId}).`;
                }
                else if (kind === 'tempban') {
                    if (!target.bannable)
                        throw new Error('Auralis lacks Ban Members or its role is not high enough.');
                    const ms = (0, core_js_1.parseDuration)(thresholdActions.tempbanDuration) ?? 604800000;
                    const expiry = Date.now() + ms;
                    extraCaseId = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'TEMPBAN', `Automatic threshold reached after ${count} active warnings.`, ms, expiry);
                    try {
                        await target.ban({ reason: `Case #${extraCaseId}: automatic warning threshold` });
                    }
                    catch (error) {
                        removeFailedCase(extraCaseId);
                        throw error;
                    }
                    automaticAction = `Automatic threshold action applied: temporary ban for ${(0, core_js_1.formatDuration)(ms)} (case #${extraCaseId}), expires <t:${Math.floor(expiry / 1000)}:F> (<t:${Math.floor(expiry / 1000)}:R>).`;
                }
                else if (kind === 'kick') {
                    if (!target.kickable)
                        throw new Error('Auralis lacks Kick Members or its role is not high enough.');
                    extraCaseId = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'KICK', `Automatic threshold reached after ${count} active warnings.`);
                    try {
                        await target.kick(`Case #${extraCaseId}: automatic warning threshold`);
                    }
                    catch (error) {
                        removeFailedCase(extraCaseId);
                        throw error;
                    }
                    automaticAction = `Automatic threshold action applied: kick (case #${extraCaseId}).`;
                }
                else if (kind === 'timeout') {
                    if (!target.moderatable)
                        throw new Error('Auralis lacks Moderate Members or its role is not high enough.');
                    const ms = Math.min(28 * 86400000, (0, core_js_1.parseDuration)(thresholdActions.timeoutDuration) ?? 3600000);
                    const expiry = Date.now() + ms;
                    extraCaseId = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'TIMEOUT', `Automatic threshold reached after ${count} active warnings.`, ms, expiry);
                    try {
                        await target.timeout(ms, `Case #${extraCaseId}: automatic warning threshold`);
                    }
                    catch (error) {
                        removeFailedCase(extraCaseId);
                        throw error;
                    }
                    automaticAction = `Automatic threshold action applied: timeout for ${(0, core_js_1.formatDuration)(ms)} (case #${extraCaseId}), expires <t:${Math.floor(expiry / 1000)}:F> (<t:${Math.floor(expiry / 1000)}:R>).`;
                }
            }
            catch (error) {
                automaticAction = `The warning was recorded, but the configured automatic action could not be applied: ${String(error?.message ?? error).slice(0, 300)}`;
            }
        }
    }
    const dmSent = await (0, core_js_1.dmTemplate)(target.user, interaction.guild, cfg.dmTemplates.warn, {
        reason: r, moderator: interaction.user.tag, caseId: id, warningId, warningCount: count,
        automaticAction: automaticAction || 'No automatic threshold punishment was triggered.'
    });
    return { id, warningId, count, dmSent, automaticAction };
}
async function ban(interaction, target, reason) {
    await assertTarget(interaction, target, discord_js_1.PermissionFlagsBits.BanMembers, 'Ban Members', 'ban');
    await target.user.createDM().catch(() => null);
    const r = reasonOrDefault(reason);
    const id = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'BAN', r);
    try {
        await target.ban({ reason: `Case #${id}: ${r}` });
    }
    catch (error) {
        removeFailedCase(id);
        throw error;
    }
    const dmSent = await (0, core_js_1.dmTemplate)(target.user, interaction.guild, (0, db_js_1.getGuildConfig)(interaction.guild.id).dmTemplates.ban, { reason: r, moderator: interaction.user.tag, caseId: id, duration: 'Permanent', expiresAt: 'Permanent' });
    return { id, dmSent };
}
async function tempban(interaction, target, duration, reason) {
    await assertTarget(interaction, target, discord_js_1.PermissionFlagsBits.BanMembers, 'Ban Members', 'ban');
    await target.user.createDM().catch(() => null);
    const ms = (0, core_js_1.parseDuration)(duration);
    if (!ms)
        throw new Error(config_js_1.config.messages.invalidDuration);
    const r = reasonOrDefault(reason);
    const expires = Date.now() + ms;
    const id = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'TEMPBAN', r, ms, expires);
    try {
        await target.ban({ reason: `Case #${id}: ${r}` });
    }
    catch (error) {
        removeFailedCase(id);
        throw error;
    }
    const dmSent = await (0, core_js_1.dmTemplate)(target.user, interaction.guild, (0, db_js_1.getGuildConfig)(interaction.guild.id).dmTemplates.tempban, { reason: r, moderator: interaction.user.tag, duration: (0, core_js_1.formatDuration)(ms), caseId: id, expiresAt: `<t:${Math.floor(expires / 1000)}:F> (<t:${Math.floor(expires / 1000)}:R>)` });
    return { id, dmSent, durationMs: ms, expiresAt: expires };
}
async function kick(interaction, target, reason) {
    await assertTarget(interaction, target, discord_js_1.PermissionFlagsBits.KickMembers, 'Kick Members', 'kick');
    await target.user.createDM().catch(() => null);
    const r = reasonOrDefault(reason);
    const id = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'KICK', r);
    try {
        await target.kick(`Case #${id}: ${r}`);
    }
    catch (error) {
        removeFailedCase(id);
        throw error;
    }
    const dmSent = await (0, core_js_1.dmTemplate)(target.user, interaction.guild, (0, db_js_1.getGuildConfig)(interaction.guild.id).dmTemplates.kick, { reason: r, moderator: interaction.user.tag, caseId: id });
    return { id, dmSent };
}
async function timeout(interaction, target, duration, reason) {
    await assertTarget(interaction, target, discord_js_1.PermissionFlagsBits.ModerateMembers, 'Moderate Members', 'timeout');
    const ms = (0, core_js_1.parseDuration)(duration);
    if (!ms)
        throw new Error(config_js_1.config.messages.invalidDuration);
    if (ms > 28 * 86400000)
        throw new Error('Discord timeouts cannot exceed 28 days. Use a duration up to 28d.');
    const r = reasonOrDefault(reason);
    const expires = Date.now() + ms;
    const id = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'TIMEOUT', r, ms, expires);
    try {
        await target.timeout(ms, `Case #${id}: ${r}`);
    }
    catch (error) {
        removeFailedCase(id);
        throw error;
    }
    const dmSent = await (0, core_js_1.dmTemplate)(target.user, interaction.guild, (0, db_js_1.getGuildConfig)(interaction.guild.id).dmTemplates.timeout, { reason: r, moderator: interaction.user.tag, duration: (0, core_js_1.formatDuration)(ms), caseId: id, expiresAt: `<t:${Math.floor(expires / 1000)}:F> (<t:${Math.floor(expires / 1000)}:R>)` });
    return { id, dmSent, durationMs: ms, expiresAt: expires };
}
async function untimeout(interaction, target, reason = 'Timeout removed by staff') {
    await assertTarget(interaction, target, discord_js_1.PermissionFlagsBits.ModerateMembers, 'Moderate Members', 'timeout');
    if (!target.communicationDisabledUntilTimestamp)
        throw new Error(`${target.user.tag} is not currently timed out.`);
    const auditReason = reasonOrDefault(reason);
    await target.timeout(null, `Auralis: ${auditReason}`);
    db_js_1.db.prepare("UPDATE cases SET active=0 WHERE guild_id=? AND user_id=? AND type IN ('TIMEOUT','HONEYPOT_TIMEOUT') AND active=1").run(interaction.guild.id, target.id);
    const id = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'UNTIMEOUT', auditReason);
    const dmSent = await (0, core_js_1.dmTemplate)(target.user, interaction.guild, (0, db_js_1.getGuildConfig)(interaction.guild.id).dmTemplates.untimeout, { moderator: interaction.user.tag, caseId: id });
    return { id, dmSent };
}
async function unban(guild, userId, moderatorId, context = null, reason = 'User unbanned by staff') {
    if (context)
        assertPermission(context, discord_js_1.PermissionFlagsBits.BanMembers, 'Ban Members');
    const normalizedId = String(userId ?? '').trim().match(/^\d{17,20}$/)?.[0];
    if (!normalizedId)
        throw new Error('Enter a valid Discord user ID.');
    const auditReason = reasonOrDefault(reason);
    await guild.members.unban(normalizedId, `Auralis unban by ${moderatorId}: ${auditReason}`);
    db_js_1.db.prepare("UPDATE cases SET active=0 WHERE guild_id=? AND user_id=? AND type IN ('BAN','TEMPBAN','HONEYPOT_BAN') AND active=1").run(guild.id, normalizedId);
    const id = (0, core_js_1.makeCase)(guild.id, normalizedId, moderatorId, 'UNBAN', auditReason);
    const user = await guild.client.users.fetch(normalizedId).catch(() => null);
    const dmSent = user ? await (0, core_js_1.dmTemplate)(user, guild, (0, db_js_1.getGuildConfig)(guild.id).dmTemplates.unban, { moderator: context?.user?.tag ?? String(moderatorId), caseId: id }) : false;
    return { id, dmSent };
}
async function purge(channel, amount) {
    const n = Math.min(100, Math.max(1, Number(amount)));
    const deleted = await channel.bulkDelete(n, true);
    return deleted.size;
}
async function cleanup(channel, amount = 100) {
    const messages = await channel.messages.fetch({ limit: Math.min(100, Math.max(1, Number(amount))) });
    const botMessages = messages.filter(m => m.author.bot || m.content.startsWith('.'));
    return (await channel.bulkDelete(botMessages, true)).size;
}
async function lockdownChannel(channel, reason = 'Auralis lockdown') {
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: false }, { reason });
}
async function unlockChannel(channel, reason = 'Auralis unlock') {
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: null }, { reason });
}
async function stripMember(interaction, member, reason) {
    await assertRoleManagementTarget(interaction, member);
    const roles = member.roles.cache.filter(r => r.id !== member.guild.id && r.editable).map(r => r.id);
    if (!roles.length)
        return [];
    await member.roles.remove(roles, String(reason ?? '').trim().slice(0, 450) || 'Auralis strip');
    return roles;
}
async function assertRoleManagementTarget(interaction, target) {
    assertPermission(interaction, discord_js_1.PermissionFlagsBits.ManageRoles, 'Manage Roles');
    const botMember = interaction?.guild?.members?.me;
    const actorMember = interaction?.guild?.members?.cache?.get(interaction?.user?.id)
        ?? await interaction?.guild?.members?.fetch?.(interaction?.user?.id).catch(() => null);
    if (!actorIsGuildOwner(interaction) && !actorMember?.roles?.highest) {
        throw new Error('Auralis could not verify your server role hierarchy. Please try again, or ask an administrator to check the member cache and permissions.');
    }
    const failure = (0, moderation_policy_js_1.moderationTargetFailure)({
        actorId: interaction?.user?.id,
        targetId: target?.id,
        guildOwnerId: interaction?.guild?.ownerId,
        botId: botMember?.id ?? interaction?.client?.user?.id,
        actorIsOwner: actorIsGuildOwner(interaction),
        actorAboveTarget: roleAbove(actorMember ?? interaction?.member, target),
        botAboveTarget: botRoleAbove(interaction, target),
        botCanAct: Boolean(botMember?.permissions?.has(discord_js_1.PermissionFlagsBits.ManageRoles) && target?.manageable),
        action: 'roles'
    });
    if (failure)
        throw new Error(failure);
}
async function jailMember(interaction, target, reason) {
    await assertRoleManagementTarget(interaction, target);
    const cfg = (0, db_js_1.getGuildConfig)(interaction.guild.id);
    if (!cfg.jailDefaults.roleId)
        throw new Error('No jail role is configured. Configure Dashboard → Security or use /setjail.');
    const jailRole = interaction.guild.roles.cache.get(String(cfg.jailDefaults.roleId));
    if (!jailRole)
        throw new Error('The configured jail role no longer exists. Select a valid role in Dashboard → Security.');
    if (!jailRole.editable)
        throw new Error('Auralis cannot assign the configured jail role. Move the bot role above the jail role.');
    const existing = db_js_1.db.prepare('SELECT * FROM jailed_roles WHERE guild_id=? AND user_id=?').get(interaction.guild.id, target.id);
    if (existing)
        throw new Error(`${target.user.tag} is already jailed; no duplicate jail case or DM was created.`);
    const roles = target.roles.cache.filter(r => r.id !== interaction.guild.id && r.editable).map(r => r.id);
    const r = reasonOrDefault(reason);
    await target.roles.set([jailRole.id], r).catch(error => { throw new Error(`Could not apply the jail role: ${error?.message ?? error}`); });
    try {
        db_js_1.db.prepare('INSERT OR REPLACE INTO jailed_roles(guild_id,user_id,roles,jailed_at) VALUES(?,?,?,?)').run(interaction.guild.id, target.id, JSON.stringify(roles), Date.now());
    }
    catch (error) {
        await target.roles.set(roles.filter(id => interaction.guild.roles.cache.get(id)?.editable), 'Auralis jail rollback after database error').catch(() => { });
        throw error;
    }
    const id = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'JAIL', r);
    const dmSent = await (0, core_js_1.dmTemplate)(target.user, interaction.guild, cfg.dmTemplates.jail, { reason: r, moderator: interaction.user.tag, caseId: id });
    return { id, dmSent };
}
async function unjail(interaction, target) {
    await assertRoleManagementTarget(interaction, target);
    const row = db_js_1.db.prepare('SELECT * FROM jailed_roles WHERE guild_id=? AND user_id=?').get(interaction.guild.id, target.id);
    if (!row)
        throw new Error('That member is not jailed. No changes were made.');
    const storedRoles = JSON.parse(row.roles);
    const valid = storedRoles.filter(id => interaction.guild.roles.cache.get(id)?.editable);
    await target.roles.set(valid, 'Auralis unjail');
    db_js_1.db.prepare('DELETE FROM jailed_roles WHERE guild_id=? AND user_id=?').run(interaction.guild.id, target.id);
    const id = (0, core_js_1.makeCase)(interaction.guild.id, target.id, interaction.user.id, 'UNJAIL', 'User released from jail.');
    const dmSent = await (0, core_js_1.dmTemplate)(target.user, interaction.guild, (0, db_js_1.getGuildConfig)(interaction.guild.id).dmTemplates.unjail, { moderator: interaction.user.tag, caseId: id });
    return { id, dmSent, rolesRestored: valid.length, rolesSkipped: storedRoles.length - valid.length };
}
function history(guildId, userId) { return db_js_1.db.prepare('SELECT * FROM cases WHERE guild_id=? AND user_id=? ORDER BY created_at DESC').all(guildId, userId); }
function warnings(guildId, userId) { return db_js_1.db.prepare('SELECT * FROM warnings WHERE guild_id=? AND user_id=? AND active=1 ORDER BY created_at DESC').all(guildId, userId); }
function activeWarningCount(guildId, userId) {
    return Number(db_js_1.db.prepare('SELECT COUNT(*) AS count FROM warnings WHERE guild_id=? AND user_id=? AND active=1').get(String(guildId), String(userId))?.count ?? 0);
}
function removeWarning(guildId, warningId) {
    const warning = db_js_1.db.prepare('SELECT * FROM warnings WHERE guild_id=? AND id=? AND active=1').get(String(guildId), Number(warningId));
    if (!warning)
        return null;
    db_js_1.db.prepare('UPDATE warnings SET active=0 WHERE guild_id=? AND id=? AND active=1').run(String(guildId), Number(warningId));
    return warning;
}
function clearWarnings(guildId, userId) {
    return Number(db_js_1.db.prepare('UPDATE warnings SET active=0 WHERE guild_id=? AND user_id=? AND active=1').run(String(guildId), String(userId)).changes ?? 0);
}
function punishmentCount(guildId, userId, kind) {
    const types = {
        warn: ['WARN'], ban: ['BAN', 'TEMPBAN', 'HONEYPOT_BAN'], tempban: ['TEMPBAN'], kick: ['KICK', 'HONEYPOT_KICK'],
        timeout: ['TIMEOUT', 'HONEYPOT_TIMEOUT'], jail: ['JAIL']
    }[String(kind).toLowerCase()] ?? [String(kind).toUpperCase()];
    const placeholders = types.map(() => '?').join(',');
    return Number(db_js_1.db.prepare(`SELECT COUNT(*) AS count FROM cases WHERE guild_id=? AND user_id=? AND type IN (${placeholders})`).get(String(guildId), String(userId), ...types)?.count ?? 0);
}
function punishmentStats(guildId, userId) {
    const rows = db_js_1.db.prepare('SELECT type, COUNT(*) AS count FROM cases WHERE guild_id=? AND user_id=? GROUP BY type').all(String(guildId), String(userId));
    const totals = Object.fromEntries(rows.map(row => [String(row.type).toUpperCase(), Number(row.count)]));
    const sum = types => types.reduce((total, type) => total + (totals[type] || 0), 0);
    return {
        warnings: sum(['WARN']),
        activeWarnings: activeWarningCount(guildId, userId),
        bans: sum(['BAN', 'HONEYPOT_BAN']),
        temporaryBans: sum(['TEMPBAN']),
        kicks: sum(['KICK', 'HONEYPOT_KICK']),
        timeouts: sum(['TIMEOUT', 'HONEYPOT_TIMEOUT']),
        jails: sum(['JAIL']),
        totalCases: rows.reduce((total, row) => total + Number(row.count), 0),
        byType: totals
    };
}
function caseLog(id, guildId) { return db_js_1.db.prepare('SELECT * FROM cases WHERE id=? AND guild_id=?').get(id, guildId); }
function recentKicks(guildId, limit = 20) { return db_js_1.db.prepare("SELECT * FROM cases WHERE guild_id=? AND type='KICK' ORDER BY created_at DESC LIMIT ?").all(guildId, limit); }
function banlistFromCases(guildId) { return db_js_1.db.prepare("SELECT * FROM cases WHERE guild_id=? AND type IN ('BAN','TEMPBAN','HONEYPOT_BAN') AND active=1 ORDER BY created_at DESC").all(guildId); }
async function timeoutAll(guild) {
    let count = 0;
    for (const member of guild.members.cache.values()) {
        if (!member.communicationDisabledUntilTimestamp || !member.moderatable)
            continue;
        try {
            await member.timeout(null, 'Auralis untimeoutall');
            count++;
        }
        catch (error) {
            console.warn(`[Auralis] could not remove timeout from ${member.id}: ${(0, core_js_1.cleanError)(error)}`);
        }
    }
    return count;
}
function auditEntries(guild, limit) { return guild.fetchAuditLogs({ limit: Math.min(100, Math.max(1, Number(limit ?? 20))) }); }

});
__factories.set("src/systems/polls.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPoll = getPoll;
exports.activePolls = activePolls;
exports.pollResults = pollResults;
exports.registerPoll = registerPoll;
exports.buildPollMessagePayload = buildPollMessagePayload;
exports.startPoll = startPoll;
exports.finishPoll = finishPoll;
exports.handlePollInteraction = handlePollInteraction;
const discord_js_1 = require("discord.js");
const db_js_1 = require("../db.js");
const config_js_1 = require("../config.js");
const core_js_1 = require("../lib/core.js");
db_js_1.db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    message_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    options TEXT NOT NULL,
    end_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    closed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_polls_status_end ON polls(status, end_at);
  CREATE TABLE IF NOT EXISTS poll_votes_v2 (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(message_id, user_id, option_index)
  );
  CREATE INDEX IF NOT EXISTS idx_poll_votes_v2_message ON poll_votes_v2(message_id, option_index);
`);
const pollByMessageStatement = db_js_1.db.prepare('SELECT * FROM polls WHERE message_id=?');
function decodePoll(row) {
    if (!row)
        return null;
    let options = [];
    if (Array.isArray(row.options))
        options = row.options;
    else {
        try {
            options = JSON.parse(row.options);
        }
        catch {
            options = [];
        }
    }
    return { ...row, options: Array.isArray(options) ? options : [] };
}
function getPoll(messageId) {
    return decodePoll(pollByMessageStatement.get(String(messageId)));
}
function activePolls(guildId = null) {
    const rows = guildId
        ? db_js_1.db.prepare("SELECT * FROM polls WHERE guild_id=? AND status='active' ORDER BY end_at").all(String(guildId))
        : db_js_1.db.prepare("SELECT * FROM polls WHERE status='active' ORDER BY end_at").all();
    return rows.map(decodePoll);
}
function pollResults(messageId) {
    const counts = db_js_1.db.prepare('SELECT option_index, COUNT(*) AS votes FROM poll_votes_v2 WHERE message_id=? GROUP BY option_index').all(String(messageId));
    const byOption = new Map(counts.map(row => [Number(row.option_index), Number(row.votes)]));
    const entries = db_js_1.db.prepare('SELECT COUNT(DISTINCT user_id) AS count FROM poll_votes_v2 WHERE message_id=?').get(String(messageId))?.count ?? 0;
    return { byOption, entries: Number(entries) };
}
function registerPoll({ messageId, guildId, channelId, creatorId, title, question, description = '', options, endAt }) {
    const optionList = Array.isArray(options) ? options.map(item => String(item).trim()).filter(Boolean).slice(0, 5) : [];
    if (!/^\d{17,20}$/.test(String(messageId)))
        throw new Error('The poll message ID is invalid.');
    if (optionList.length < 2)
        throw new Error('A poll requires at least two options.');
    db_js_1.db.prepare(`INSERT INTO polls(message_id,guild_id,channel_id,creator_id,title,question,description,options,end_at,status,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,'active',?)`).run(String(messageId), String(guildId), String(channelId), String(creatorId), (0, core_js_1.truncate)(String(title || 'Poll'), 256), (0, core_js_1.truncate)(String(question || ''), 500), (0, core_js_1.truncate)(String(description || ''), 1000), JSON.stringify(optionList), Number(endAt), Date.now());
    return getPoll(messageId);
}
function label(value, fallback) {
    const candidate = String(value ?? '').trim();
    return candidate || fallback;
}
function buildPollMessagePayload(poll, includeComponents = true) {
    const parsed = decodePoll(poll);
    if (!parsed)
        throw new Error('Poll data was not found.');
    const cfg = (0, db_js_1.getGuildConfig)(parsed.guild_id);
    const defaults = cfg.pollDefaults ?? {};
    const active = parsed.status === 'active';
    const configuredColor = defaults.defaultColor ?? config_js_1.config.brand.primary;
    const color = typeof configuredColor === 'string' && configuredColor.trim().startsWith('#') ? (0, core_js_1.safeHexColor)(configuredColor, config_js_1.config.brand.primary) : (Number(configuredColor) || config_js_1.config.brand.primary);
    const results = pollResults(parsed.message_id || '');
    const voteLines = parsed.options.map((option, index) => {
        const count = results.byOption.get(index) ?? 0;
        const optionLabel = String(defaults.optionLabels?.[index] || String.fromCharCode(65 + index));
        const suffix = defaults.showCounts === false ? '' : ` — **${count}** ${count === 1 ? 'vote' : 'votes'}`;
        return `**${optionLabel}.** ${option}${suffix}`;
    });
    const body = [String(parsed.description || defaults.description || '').trim(), `**${parsed.question}**`, voteLines.join('\n')].filter(Boolean).join('\n\n');
    const fields = [
        { name: label(defaults.entriesLabel, 'Entries'), value: `**${results.entries}**`, inline: true },
        { name: label(defaults.endsLabel, 'Ends'), value: active ? `<t:${Math.floor(Number(parsed.end_at) / 1000)}:R>` : `<t:${Math.floor(Number(parsed.closed_at || Date.now()) / 1000)}:f>`, inline: true },
        { name: label(defaults.hostLabel, 'Hosted by'), value: `<@${parsed.creator_id}>`, inline: true }
    ];
    const embed = (0, core_js_1.makeEmbed)({
        title: active ? label(parsed.title, label(defaults.title, 'Poll')) : label(defaults.endedTitle, 'Poll Ended'),
        description: (0, core_js_1.truncate)(body, 3900),
        fields,
        color,
        timestamp: true
    });
    const payload = { embeds: [embed], allowedMentions: { parse: [] } };
    if (!includeComponents)
        return payload;
    const rows = [];
    const optionButtons = parsed.options.map((option, index) => new discord_js_1.ButtonBuilder()
        .setCustomId(`poll:vote:${parsed.message_id}:${index}`)
        .setLabel((0, core_js_1.truncate)(`${String(defaults.optionLabels?.[index] || String.fromCharCode(65 + index))}. ${option}`, 80))
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(!active));
    if (optionButtons.length) {
        for (let offset = 0; offset < optionButtons.length; offset += 5) {
            rows.push(new discord_js_1.ActionRowBuilder().addComponents(optionButtons.slice(offset, offset + 5)));
        }
    }
    if (defaults.allowCreatorClose !== false) {
        rows.push(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`poll:close:${parsed.message_id}`)
            .setLabel(active ? label(defaults.closeButtonLabel, 'Close Poll') : label(defaults.endedButtonLabel, 'Poll Ended'))
            .setStyle(active ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Secondary)
            .setDisabled(!active)));
    }
    payload.components = rows;
    return payload;
}
async function startPoll(channel, creator, question, options, overrides = {}) {
    const guildId = String(channel.guild.id);
    const cfg = (0, db_js_1.getGuildConfig)(guildId);
    if (cfg.modules?.polls === false || cfg.pollDefaults?.enabled === false) {
        throw new Error('Polls are disabled for this server. Enable them in the Dashboard first.');
    }
    const optionList = Array.isArray(options) ? options.map(item => String(item).trim()).filter(Boolean).slice(0, 5) : [];
    if (optionList.length < 2)
        throw new Error('Enter at least two poll options.');
    const defaults = cfg.pollDefaults ?? {};
    const durationText = String(overrides.duration || defaults.defaultDuration || '24h');
    const durationMs = (0, core_js_1.parseDuration)(durationText);
    if (!durationMs)
        throw new Error('Poll duration must look like 10m, 2h, or 7d.');
    if (durationMs > 30 * 86400000)
        throw new Error('Poll duration cannot exceed 30 days.');
    const title = (0, core_js_1.truncate)(String(overrides.title || defaults.title || 'Poll'), 256);
    const description = (0, core_js_1.truncate)(String(overrides.description ?? defaults.description ?? ''), 1000);
    const endAt = Date.now() + durationMs;
    const initial = (0, core_js_1.makeEmbed)({
        title,
        description: [description, `**${(0, core_js_1.truncate)(question, 500)}**`, optionList.map((option, index) => `**${String(defaults.optionLabels?.[index] || String.fromCharCode(65 + index))}.** ${option}`).join('\n')].filter(Boolean).join('\n\n'),
        color: (() => { const value = defaults.defaultColor ?? config_js_1.config.brand.primary; return typeof value === 'string' && value.trim().startsWith('#') ? (0, core_js_1.safeHexColor)(value, config_js_1.config.brand.primary) : (Number(value) || config_js_1.config.brand.primary); })()
    });
    const message = await channel.send({ embeds: [initial], allowedMentions: { parse: [] } });
    let poll;
    try {
        poll = registerPoll({ messageId: message.id, guildId, channelId: channel.id, creatorId: creator.id, title, question, description, options: optionList, endAt });
        await message.edit(buildPollMessagePayload(poll));
    }
    catch (error) {
        await message.delete().catch(() => { });
        throw error;
    }
    return message;
}
async function updatePollMessage(client, poll) {
    const channel = client.channels.cache.get(String(poll.channel_id)) || await client.channels.fetch(String(poll.channel_id)).catch(() => null);
    if (!channel?.isTextBased())
        return false;
    const message = await channel.messages.fetch(String(poll.message_id)).catch(() => null);
    if (!message)
        return false;
    await message.edit(buildPollMessagePayload(poll)).catch(error => {
        console.warn(`[Auralis] could not update poll ${poll.message_id}: ${error?.message ?? error}`);
    });
    return true;
}
async function finishPoll(client, source, reason = 'expired') {
    const poll = getPoll(source?.message_id ?? source);
    if (!poll || poll.status !== 'active')
        return false;
    const closedAt = Date.now();
    db_js_1.db.prepare("UPDATE polls SET status='ended',closed_at=? WHERE message_id=? AND status='active'").run(closedAt, poll.message_id);
    const ended = getPoll(poll.message_id);
    const updated = await updatePollMessage(client, ended);
    return { ok: true, reason, updated };
}
async function handlePollInteraction(interaction, client) {
    await (0, core_js_1.deferEphemeral)(interaction);
    const parts = String(interaction.customId).split(':');
    const action = parts[1];
    const messageId = parts[2];
    const poll = getPoll(messageId);
    if (!poll || String(interaction.message?.id) !== String(poll.message_id)) {
        return (0, core_js_1.safeReply)(interaction, { content: 'This poll is no longer available.', ephemeral: true });
    }
    if (poll.status !== 'active' || poll.end_at <= Date.now()) {
        if (poll.status === 'active')
            await finishPoll(client, poll, 'expired');
        return (0, core_js_1.safeReply)(interaction, { content: 'This poll has ended.', ephemeral: true });
    }
    const cfg = (0, db_js_1.getGuildConfig)(poll.guild_id);
    if (action === 'close') {
        const actorIsCreator = String(interaction.user.id) === String(poll.creator_id);
        const actorIsStaff = Boolean(interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageMessages) || interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageGuild) || interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.Administrator));
        if (!actorIsCreator && !actorIsStaff) {
            return (0, core_js_1.safeReply)(interaction, { content: 'Only the poll host or a server moderator can close this poll.', ephemeral: true });
        }
        await finishPoll(client, poll, 'manual');
        return (0, core_js_1.safeReply)(interaction, { content: 'Poll closed.', ephemeral: true });
    }
    if (action !== 'vote')
        return (0, core_js_1.safeReply)(interaction, { content: 'Unknown poll action.', ephemeral: true });
    const optionIndex = Number(parts[3]);
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
        return (0, core_js_1.safeReply)(interaction, { content: 'This poll option is no longer available.', ephemeral: true });
    }
    const alreadySelected = Boolean(db_js_1.db.prepare('SELECT 1 FROM poll_votes_v2 WHERE message_id=? AND user_id=? AND option_index=?').get(poll.message_id, interaction.user.id, optionIndex));
    if (cfg.pollDefaults?.allowMultiple === true) {
        if (alreadySelected)
            db_js_1.db.prepare('DELETE FROM poll_votes_v2 WHERE message_id=? AND user_id=? AND option_index=?').run(poll.message_id, interaction.user.id, optionIndex);
        else
            db_js_1.db.prepare('INSERT OR IGNORE INTO poll_votes_v2(message_id,user_id,option_index,created_at) VALUES(?,?,?,?)').run(poll.message_id, interaction.user.id, optionIndex, Date.now());
    }
    else {
        db_js_1.db.prepare('DELETE FROM poll_votes_v2 WHERE message_id=? AND user_id=?').run(poll.message_id, interaction.user.id);
        db_js_1.db.prepare('INSERT INTO poll_votes_v2(message_id,user_id,option_index,created_at) VALUES(?,?,?,?)').run(poll.message_id, interaction.user.id, optionIndex, Date.now());
    }
    const fresh = getPoll(poll.message_id);
    await updatePollMessage(client, fresh);
    const optionLabel = String(cfg.pollDefaults?.optionLabels?.[optionIndex] || String.fromCharCode(65 + optionIndex));
    const actionText = cfg.pollDefaults?.allowMultiple === true && alreadySelected ? 'Vote removed from' : cfg.pollDefaults?.allowMultiple === true ? 'Vote added to' : 'Vote recorded for';
    return (0, core_js_1.safeReply)(interaction, { content: `${actionText} option ${optionLabel}.`, ephemeral: true });
}

});
__factories.set("src/systems/reactions.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addReactionRole = addReactionRole;
exports.removeReactionRole = removeReactionRole;
exports.removeAllReactionRoles = removeAllReactionRoles;
exports.reactionRole = reactionRole;
exports.reactionRoles = reactionRoles;
exports.addButtonRole = addButtonRole;
exports.removeButtonRole = removeButtonRole;
exports.removeAllButtonRoles = removeAllButtonRoles;
exports.buttonRoles = buttonRoles;
const db_js_1 = require("../db.js");
function addReactionRole(guildId, messageId, emoji, roleId, channelId) { db_js_1.db.prepare('INSERT OR REPLACE INTO reaction_roles(guild_id,message_id,emoji,role_id,channel_id) VALUES(?,?,?,?,?)').run(guildId, messageId, emoji, roleId, channelId); }
function removeReactionRole(guildId, messageId, emoji) { db_js_1.db.prepare('DELETE FROM reaction_roles WHERE guild_id=? AND message_id=? AND emoji=?').run(guildId, messageId, emoji); }
function removeAllReactionRoles(guildId, messageId) { db_js_1.db.prepare('DELETE FROM reaction_roles WHERE guild_id=? AND message_id=?').run(guildId, messageId); }
function reactionRole(guildId, messageId, emoji) { return db_js_1.db.prepare('SELECT * FROM reaction_roles WHERE guild_id=? AND message_id=? AND emoji=?').get(guildId, messageId); }
function reactionRoles(guildId) { return db_js_1.db.prepare('SELECT * FROM reaction_roles WHERE guild_id=? ORDER BY message_id').all(guildId); }
function addButtonRole(guildId, messageId, index, roleId, style = 'Secondary', emoji = null, label = 'Role') { db_js_1.db.prepare('INSERT OR REPLACE INTO button_roles(guild_id,message_id,component_index,role_id,style,emoji,label) VALUES(?,?,?,?,?,?,?)').run(guildId, messageId, index, roleId, style, emoji, label); }
function removeButtonRole(guildId, messageId, index) { db_js_1.db.prepare('DELETE FROM button_roles WHERE guild_id=? AND message_id=? AND component_index=?').run(guildId, messageId, index); }
function removeAllButtonRoles(guildId, messageId) { db_js_1.db.prepare('DELETE FROM button_roles WHERE guild_id=? AND message_id=?').run(guildId, messageId); }
function buttonRoles(guildId, messageId) { return db_js_1.db.prepare('SELECT * FROM button_roles WHERE guild_id=? AND message_id=? ORDER BY component_index').all(guildId, messageId); }

});
__factories.set("src/systems/security.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.automodMessage = automodMessage;
exports.antiRaidJoin = antiRaidJoin;
exports.antinukeWhitelist = antinukeWhitelist;
exports.addAntinukeWhitelist = addAntinukeWhitelist;
exports.removeAntinukeWhitelist = removeAntinukeWhitelist;
exports.escapeRegExp = escapeRegExp;
const db_js_1 = require("../db.js");
const core_js_1 = require("../lib/core.js");
const moderation_policy_js_1 = require("../lib/moderation-policy.js");
const joins = new Map();
const messageWindows = new Map();
const duplicateMessages = new Map();
const responseCooldowns = new Map();
async function automodMessage(message, client) {
    if (!message.guild || message.author.bot)
        return false;
    const cfg = (0, db_js_1.getGuildConfig)(message.guild.id);
    const global = cfg.automodDefaults ?? {};
    const channelCfg = global.channels?.[message.channel.id] ?? {};
    const merged = { ...global, ...channelCfg };
    if (cfg.modules?.automod === false || !merged.enabled || (0, core_js_1.isStaff)(message.member)) {
        await triggerAutoResponses(message, merged.triggers ?? []);
        return false;
    }
    const hasAnyRole = (ids) => Array.isArray(ids) && ids.some(id => message.member?.roles?.cache?.has(String(id)));
    const hasAnyId = (ids) => Array.isArray(ids) && ids.map(String).includes(String(message.author.id));
    if ((merged.exemptChannelIds ?? []).map(String).includes(String(message.channel.id))
        || hasAnyId(merged.exemptUserIds) || hasAnyRole(merged.exemptRoleIds)) {
        await triggerAutoResponses(message, merged.triggers ?? []);
        return false;
    }
    const isRuleExempt = rule => (rule?.exemptChannelIds ?? []).map(String).includes(String(message.channel.id))
        || hasAnyId(rule?.exemptUserIds) || hasAnyRole(rule?.exemptRoleIds);
    const offenders = [];
    const add = (name, rule, condition) => { if (rule?.enabled && !isRuleExempt(rule) && condition)
        offenders.push([name, rule]); };
    const content = String(message.content ?? '');
    const lower = content.toLowerCase();
    const attachmentNames = [...message.attachments.values()].map(a => a.name ?? '').filter(Boolean);
    const imageCount = [...message.attachments.values()].filter(a => String(a.contentType || '').toLowerCase().startsWith('image/') || /\.(?:png|jpe?g|gif|webp|avif|bmp|tiff?)$/i.test(a.name || a.url || '')).length;
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    const emojiCount = (content.match(/<a?:\w+:\d+>|[\p{Extended_Pictographic}]/gu) ?? []).length;
    add('antiPingSpam', merged.antiPingSpam, message.mentions.users.size > Number(merged.antiPingSpam?.maxMentions ?? 5));
    add('massMention', merged.massMention, message.mentions.everyone || mentionCount > Number(merged.massMention?.maxMentions ?? 5));
    add('invites', merged.invites, /(?:discord\.gg|discord(?:app)?\.com\/invite)\//i.test(content));
    if (merged.antiLink?.enabled && !isRuleExempt(merged.antiLink)) {
        const policy = merged.antiLink;
        const normalizedDomain = value => String(value ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
        const explicitLinks = [...content.matchAll(/(?:https?:\/\/|www\.)[^\s<>]+/gi)].map(match => match[0].replace(/[),.!?]+$/, ''));
        const nakedDomains = [...content.matchAll(/(?<![@\w])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:\/[^\s<>]*)?/gi)].map(match => match[0].replace(/[),.!?]+$/, ''));
        const urls = [...new Set([...explicitLinks, ...nakedDomains])].map(raw => {
            try {
                return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase().replace(/^www\./, '');
            }
            catch {
                return '';
            }
        }).filter(Boolean);
        const matchesDomain = (hostname, entry) => {
            const domain = normalizedDomain(entry);
            return Boolean(domain && (hostname === domain || hostname.endsWith(`.${domain}`)));
        };
        const blockedDomains = Array.isArray(policy.blockedDomains) ? policy.blockedDomains : [];
        const allowList = Array.isArray(policy.allowList) ? policy.allowList : [];
        const hasBlockedDomain = urls.some(host => blockedDomains.some(domain => matchesDomain(host, domain)));
        const allLinksAllowed = urls.length > 0 && urls.every(host => (policy.allowDiscord && matchesDomain(host, 'discord.com')) ||
            (policy.allowDiscord && matchesDomain(host, 'discord.gg')) ||
            allowList.some(domain => matchesDomain(host, domain)));
        const adKeywords = Array.isArray(policy.advertisingKeywords) ? policy.advertisingKeywords : [];
        const hasAdvertising = policy.blockAdvertising === true && adKeywords.some(keyword => String(keyword).trim() && lower.includes(String(keyword).toLowerCase()));
        if (hasBlockedDomain || hasAdvertising || (urls.length > 0 && !allLinksAllowed))
            offenders.push(['antiLink', policy]);
    }
    if (merged.caps?.enabled) {
        const letters = content.replace(/[^a-z]/gi, '');
        const upper = letters.replace(/[^A-Z]/g, '');
        add('caps', merged.caps, letters.length >= Number(merged.caps.minChars ?? 12) && letters.length > 0 && upper.length / letters.length >= Number(merged.caps.percent ?? 75) / 100);
    }
    add('emojiSpam', merged.emojiSpam, emojiCount > Number(merged.emojiSpam?.maxEmojis ?? 12));
    add('bannedWords', merged.bannedWords, (merged.bannedWords?.words ?? []).filter(word => String(word).trim()).some(word => new RegExp(`\\b${escapeRegExp(String(word))}\\b`, 'i').test(content)));
    add('spoilers', merged.spoilers, /\|\|[\s\S]+?\|\|/.test(content));
    add('imageSpam', merged.imageSpam, imageCount > Number(merged.imageSpam?.maxImages ?? 4));
    add('maxCharacters', merged.maxCharacters, content.length > Number(merged.maxCharacters?.max ?? 1800));
    add('maxLines', merged.maxLines, content.split(/\r?\n/).length > Number(merged.maxLines?.max ?? 12));
    add('fileBlock', merged.fileBlock, attachmentNames.some(name => (merged.fileBlock.blockedExtensions ?? []).map(ext => String(ext).toLowerCase().replace(/^\./, '')).includes(String(name.split('.').pop()).toLowerCase())));
    const key = `${message.guild.id}:${message.channel.id}:${message.author.id}`;
    if (merged.messageRate?.enabled && !isRuleExempt(merged.messageRate)) {
        const list = messageWindows.get(key) ?? [];
        const windowMs = Math.max(1000, Number(merged.messageRate.windowSeconds ?? 6) * 1000);
        const cutoff = Date.now() - windowMs;
        list.push(Date.now());
        while (list.length && list[0] < cutoff)
            list.shift();
        messageWindows.set(key, list);
        if (list.length > Number(merged.messageRate.messages ?? 7))
            offenders.push(['messageRate', merged.messageRate]);
    }
    if (merged.duplicateText?.enabled && !isRuleExempt(merged.duplicateText) && content.trim().length >= Number(merged.duplicateText.minCharacters ?? 5)) {
        const normalized = content.toLowerCase().replace(/\s+/g, ' ').replace(/[\p{P}\p{S}]/gu, '').trim();
        const duplicateKey = `${message.guild.id}:${message.channel.id}:${message.author.id}`;
        const previous = duplicateMessages.get(duplicateKey);
        const now = Date.now();
        const windowMs = Math.max(1000, Number(merged.duplicateText.windowSeconds ?? 30) * 1000);
        if (previous && previous.text === normalized && now - previous.at <= windowMs)
            offenders.push(['duplicateText', merged.duplicateText]);
        duplicateMessages.set(duplicateKey, { text: normalized, at: now });
    }
    if (!offenders.length) {
        await triggerAutoResponses(message, merged.triggers ?? []);
        return false;
    }
    const [rule, ruleConfig] = offenders[0];
    const ruleName = String(rule).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
    const validActions = new Set(['delete', 'warn', 'timeout', 'kick', 'ban', 'log']);
    const action = validActions.has(String(ruleConfig.action)) ? String(ruleConfig.action) : 'delete';
    let caseId = null;
    let outcome = action === 'log' ? 'Logged only' : action === 'delete' ? 'Message deleted' : action;
    const reason = `Auralis AutoMod: ${ruleName}`;
    const deleteMessage = ruleConfig.deleteMessage !== false && action !== 'log';
    if (deleteMessage && message.deletable)
        await message.delete().catch(() => { });
    const targetMember = message.member;
    const botMember = message.guild.members.me;
    const botAboveTarget = Boolean(botMember?.roles?.highest && targetMember?.roles?.highest
        && botMember.roles.highest.comparePositionTo(targetMember.roles.highest) > 0);
    const automaticTargetFailure = ['warn', 'timeout', 'kick', 'ban'].includes(action)
        ? (0, moderation_policy_js_1.automaticModerationTargetFailure)({
            targetId: message.author.id,
            guildOwnerId: message.guild.ownerId,
            botId: client.user?.id,
            targetIsBot: Boolean(message.author.bot),
            botAboveTarget,
            botCanAct: action === 'warn' ? true : action === 'timeout' ? Boolean(targetMember?.moderatable)
                : action === 'kick' ? Boolean(targetMember?.kickable) : Boolean(targetMember?.bannable),
            action
        })
        : null;
    if (automaticTargetFailure) {
        outcome = `No punishment applied: ${automaticTargetFailure}`;
    }
    else
        try {
            if (action === 'warn') {
                caseId = (0, core_js_1.makeCase)(message.guild.id, message.author.id, client.user.id, 'AUTOMOD_WARN', reason, null, null, { rule, channelId: message.channel.id, messageId: message.id });
                db_js_1.db.prepare('INSERT INTO warnings(guild_id,user_id,moderator_id,reason,created_at) VALUES(?,?,?,?,?)').run(message.guild.id, message.author.id, client.user.id, reason, Date.now());
                outcome = 'Warning recorded';
            }
            else if (action === 'timeout') {
                if (!message.member?.moderatable)
                    throw new Error('Member is not timeout-able by the bot.');
                const durationMs = Math.min(28 * 86400000, Math.max(1000, Number(ruleConfig.durationSeconds ?? 300) * 1000));
                caseId = (0, core_js_1.makeCase)(message.guild.id, message.author.id, client.user.id, 'AUTOMOD_TIMEOUT', reason, durationMs, Date.now() + durationMs, { rule, channelId: message.channel.id, messageId: message.id });
                await message.member.timeout(durationMs, reason);
                outcome = `Timed out for ${Math.round(durationMs / 1000)} seconds`;
            }
            else if (action === 'kick') {
                if (!message.member?.kickable)
                    throw new Error('Member is not kickable by the bot.');
                caseId = (0, core_js_1.makeCase)(message.guild.id, message.author.id, client.user.id, 'AUTOMOD_KICK', reason, null, null, { rule, channelId: message.channel.id, messageId: message.id });
                await message.member.kick(reason);
                outcome = 'Member kicked';
            }
            else if (action === 'ban') {
                if (!message.member?.bannable)
                    throw new Error('Member is not bannable by the bot.');
                caseId = (0, core_js_1.makeCase)(message.guild.id, message.author.id, client.user.id, 'AUTOMOD_BAN', reason, null, null, { rule, channelId: message.channel.id, messageId: message.id });
                await message.member.ban({ reason });
                outcome = 'Member banned';
            }
        }
        catch (error) {
            if (caseId)
                db_js_1.db.prepare('DELETE FROM cases WHERE id=?').run(caseId);
            outcome = `${outcome} failed: ${(0, core_js_1.truncate)(error?.message ?? error, 180)}`;
        }
    const template = action === 'timeout' ? cfg.automodMessages?.timeout : action === 'warn' ? cfg.automodMessages?.warning : cfg.automodMessages?.blocked;
    if (cfg.automodDefaults?.notifyUser !== false && ['warn', 'timeout', 'kick', 'ban'].includes(action)) {
        const notice = (0, core_js_1.replacePlaceholders)(template || 'A server moderation rule was triggered.', {
            user: `<@${message.author.id}>`, username: message.author.username, server: message.guild.name,
            channel: `#${message.channel.name}`, rule: ruleName, reason, action: outcome,
            duration: action === 'timeout' ? `${Math.round(Number(ruleConfig.durationSeconds ?? 300))} seconds` : 'Permanent',
            caseId: caseId ?? 'Not created'
        });
        await message.author.send({ content: (0, core_js_1.truncate)(notice, 1900), allowedMentions: { parse: [] } }).catch(() => { });
    }
    if (cfg.automodDefaults?.publicNotice === true && action !== 'log' && message.channel?.send) {
        const notice = (0, core_js_1.replacePlaceholders)(cfg.automodMessages?.blocked || 'A message was removed by AutoMod.', { user: `<@${message.author.id}>`, username: message.author.username, server: message.guild.name, channel: `#${message.channel.name}`, rule: ruleName, action: outcome });
        await message.channel.send({ content: (0, core_js_1.truncate)(notice, 1900), allowedMentions: { parse: [] } }).catch(() => { });
    }
    const logId = cfg.loggingDefaults?.channels?.automod || cfg.loggingDefaults?.channels?.audit;
    if (logId)
        message.guild.channels.cache.get(String(logId))?.send({
            embeds: [(0, core_js_1.makeEmbed)({ color: 0xF36B7F, title: 'AutoMod action', description: `${message.author} — **${ruleName}** — <#${message.channel.id}>`, fields: [
                        { name: 'Action', value: (0, core_js_1.truncate)(outcome, 1024), inline: true },
                        { name: 'Case', value: caseId ? `#${caseId}` : 'Not created', inline: true },
                        { name: 'Message', value: (0, core_js_1.truncate)(content || '[no text]', 900) }
                    ], timestamp: true })], allowedMentions: { parse: [] }
        }).catch(() => { });
    return true;
}
async function triggerAutoResponses(message, triggers) {
    if (!Array.isArray(triggers) || !message.guild)
        return;
    const featureFlags = (0, db_js_1.getGuildConfig)(message.guild.id).modules ?? {};
    if (featureFlags.automations === false || featureFlags.responses === false)
        return;
    for (const trigger of triggers.slice(0, 100)) {
        if (!trigger || trigger.enabled === false || !String(trigger.keyword ?? '').trim() || (!trigger.reply && !trigger.embed?.description && !trigger.embed?.title))
            continue;
        const channelIds = Array.isArray(trigger.channelIds) ? trigger.channelIds.map(String) : [];
        const exemptChannelIds = Array.isArray(trigger.exemptChannelIds) ? trigger.exemptChannelIds.map(String) : [];
        if (channelIds.length && !channelIds.includes(String(message.channel.id)))
            continue;
        if (exemptChannelIds.includes(String(message.channel.id)))
            continue;
        const roleIds = Array.isArray(trigger.allowedRoleIds) ? trigger.allowedRoleIds.map(String) : [];
        const exemptRoleIds = Array.isArray(trigger.exemptRoleIds) ? trigger.exemptRoleIds.map(String) : [];
        const allowedUserIds = Array.isArray(trigger.allowedUserIds) ? trigger.allowedUserIds.map(String) : [];
        const exemptUserIds = Array.isArray(trigger.exemptUserIds) ? trigger.exemptUserIds.map(String) : [];
        if (allowedUserIds.length && !allowedUserIds.includes(String(message.author.id)))
            continue;
        if (exemptUserIds.includes(String(message.author.id)))
            continue;
        if (roleIds.length && !roleIds.some(id => message.member?.roles?.cache?.has(id)))
            continue;
        if (exemptRoleIds.some(id => message.member?.roles?.cache?.has(id)))
            continue;
        const input = trigger.caseSensitive === true ? String(message.content ?? '') : String(message.content ?? '').toLowerCase();
        const keyword = trigger.caseSensitive === true ? String(trigger.keyword) : String(trigger.keyword).toLowerCase();
        const matchType = ['exact', 'startsWith', 'contains'].includes(trigger.matchType) ? trigger.matchType : 'contains';
        const matched = matchType === 'exact' ? input.trim() === keyword : matchType === 'startsWith' ? input.trimStart().startsWith(keyword) : input.includes(keyword);
        if (!matched)
            continue;
        const cooldownSeconds = Math.max(0, Math.min(86400, Number(trigger.cooldownSeconds) || 0));
        if (cooldownSeconds) {
            const cooldownKey = `${message.guild.id}:${String(trigger.id || trigger.keyword)}:${message.author.id}`;
            const nextAt = responseCooldowns.get(cooldownKey) || 0;
            if (nextAt > Date.now())
                continue;
            responseCooldowns.set(cooldownKey, Date.now() + cooldownSeconds * 1000);
        }
        const values = { user: message.author.toString(), username: message.author.username, server: message.guild.name, channel: message.channel.toString(), prefix: String((0, db_js_1.getGuildConfig)(message.guild.id).discord?.defaultPrefix ?? '.'), memberCount: message.guild.memberCount, userId: message.author.id, guildId: message.guild.id, keyword: String(trigger.keyword) };
        const payload = { allowedMentions: { parse: [], users: [] } };
        const reply = (0, core_js_1.replacePlaceholders)(String(trigger.reply ?? ''), values);
        if (reply.trim())
            payload.content = (0, core_js_1.truncate)(reply, 1900);
        if (trigger.embed && typeof trigger.embed === 'object') {
            const embed = trigger.embed;
            const numericColor = typeof embed.color === 'number' ? embed.color : Number.parseInt(String(embed.color || '#7C6CF5').replace('#', ''), 16);
            const description = (0, core_js_1.replacePlaceholders)(String(embed.description ?? ''), values);
            payload.embeds = [(0, core_js_1.makeEmbed)({
                    title: embed.title ? (0, core_js_1.replacePlaceholders)(String(embed.title), values).slice(0, 256) : undefined,
                    description: description ? (0, core_js_1.truncate)(description, 4096) : undefined,
                    color: Number.isFinite(numericColor) ? numericColor : 0x7c6cf5,
                    url: /^https?:\/\//i.test(String(embed.url ?? '')) ? String(embed.url) : undefined,
                    thumbnail: /^https?:\/\//i.test(String(embed.thumbnailUrl ?? '')) ? String(embed.thumbnailUrl) : undefined,
                    image: /^https?:\/\//i.test(String(embed.imageUrl ?? '')) ? String(embed.imageUrl) : undefined,
                    footer: embed.footerText ? (0, core_js_1.replacePlaceholders)(String(embed.footerText), values).slice(0, 2048) : undefined,
                    timestamp: embed.timestamp === true
                })];
        }
        const mode = ['dm', 'reply', 'channel'].includes(trigger.responseMode) ? trigger.responseMode : 'channel';
        if (mode === 'dm')
            await message.author.send(payload).catch(() => null);
        else if (mode === 'reply')
            await message.reply(payload).catch(() => null);
        else
            await message.channel.send(payload).catch(() => null);
        if (trigger.deleteInvocation && message.deletable)
            await message.delete().catch(() => { });
        break;
    }
}
function antiRaidJoin(guildId, userId, isBot) {
    const cfg = (0, db_js_1.getGuildConfig)(guildId);
    if (!cfg.antiRaid.enabled || (isBot && cfg.antiRaid.ignoreBots))
        return { triggered: false, count: 0 };
    const now = Date.now();
    const list = joins.get(guildId) ?? [];
    const cutoff = now - cfg.antiRaid.joinWindowSeconds * 1000;
    list.push({ userId, now });
    while (list[0]?.now < cutoff)
        list.shift();
    joins.set(guildId, list);
    return { triggered: list.length >= cfg.antiRaid.maxJoins, count: list.length };
}
function antinukeWhitelist(guildId) { return db_js_1.db.prepare('SELECT * FROM guild_settings WHERE guild_id=?').get(guildId); }
function addAntinukeWhitelist(guildId, userId) {
    const cfg = (0, db_js_1.getGuildConfig)(guildId);
    cfg.antinuke.whitelist ??= [];
    if (!cfg.antinuke.whitelist.includes(userId))
        cfg.antinuke.whitelist.push(userId);
    db_js_1.db.prepare('INSERT INTO guild_settings(guild_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(guild_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').run(guildId, JSON.stringify(cfg), Date.now());
}
function removeAntinukeWhitelist(guildId, userId) { const cfg = (0, db_js_1.getGuildConfig)(guildId); cfg.antinuke.whitelist = (cfg.antinuke.whitelist ?? []).filter(x => x !== userId); db_js_1.db.prepare('UPDATE guild_settings SET data=?,updated_at=? WHERE guild_id=?').run(JSON.stringify(cfg), Date.now(), guildId); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

});
__factories.set("src/systems/staff-activity.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureStaffActivityConfig = ensureStaffActivityConfig;
exports.recordStaffMessage = recordStaffMessage;
exports.recordStaffCommand = recordStaffCommand;
exports.recordTicketClose = recordTicketClose;
exports.getStaffActivity = getStaffActivity;
exports.getCurrentCheck = getCurrentCheck;
exports.getCheckResponse = getCheckResponse;
exports.sendStaffActivityPanelToChannel = sendStaffActivityPanelToChannel;
exports.sendStaffActivityPanel = sendStaffActivityPanel;
exports.sendScheduledStaffActivityChecks = sendScheduledStaffActivityChecks;
exports.respondToStaffActivity = respondToStaffActivity;
exports.showStaffActivity = showStaffActivity;
exports.buildStaffActivityPayload = buildStaffActivityPayload;
exports.staffActivityLeaderboard = staffActivityLeaderboard;
const discord_js_1 = require("discord.js");
const db_js_1 = require("../db.js");
const config_js_1 = require("../config.js");
const core_js_1 = require("../lib/core.js");
function ensureStaffActivityConfig(cfg) {
    cfg.staffActivityDefaults ??= {};
    for (const [key, value] of Object.entries(config_js_1.config.staffActivityDefaults ?? {})) {
        if (cfg.staffActivityDefaults[key] === undefined)
            cfg.staffActivityDefaults[key] = structuredClone(value);
    }
    if (!Array.isArray(cfg.staffActivityDefaults.staffRoleIds))
        cfg.staffActivityDefaults.staffRoleIds = [];
    if (!Array.isArray(cfg.staffActivityDefaults.excludedRoleIds))
        cfg.staffActivityDefaults.excludedRoleIds = [];
    return cfg.staffActivityDefaults;
}
function activityRow(guildId, userId) {
    db_js_1.db.prepare('INSERT OR IGNORE INTO staff_activity(guild_id,user_id,last_active_at) VALUES(?,?,0)').run(guildId, userId);
    return db_js_1.db.prepare('SELECT * FROM staff_activity WHERE guild_id=? AND user_id=?').get(guildId, userId);
}
function recordStaffMessage(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    globalThis.__auralisStaffActivityBuckets ??= new Map();
    const previous = globalThis.__auralisStaffActivityBuckets.get(key) ?? 0;
    if (now - previous < 60_000)
        return;
    globalThis.__auralisStaffActivityBuckets.set(key, now);
    db_js_1.db.prepare('INSERT INTO staff_activity(guild_id,user_id,message_count,command_count,ticket_closes,moderation_actions,last_active_at) VALUES(?,?,1,0,0,0,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET message_count=message_count+1,last_active_at=excluded.last_active_at').run(guildId, userId, now);
    db_js_1.db.prepare("INSERT INTO staff_activity_events(guild_id,user_id,event_type,detail,created_at) VALUES(?,?, 'message', '', ?)").run(guildId, userId, now);
}
function recordStaffCommand(guildId, userId) {
    const now = Date.now();
    db_js_1.db.prepare('INSERT INTO staff_activity(guild_id,user_id,message_count,command_count,ticket_closes,moderation_actions,last_active_at) VALUES(?,?,0,1,0,1,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET command_count=command_count+1,moderation_actions=moderation_actions+1,last_active_at=excluded.last_active_at').run(guildId, userId, now);
    db_js_1.db.prepare("INSERT INTO staff_activity_events(guild_id,user_id,event_type,detail,created_at) VALUES(?,?, 'command', '', ?)").run(guildId, userId, now);
}
function recordTicketClose(guildId, userId) {
    const now = Date.now();
    db_js_1.db.prepare('INSERT INTO staff_activity(guild_id,user_id,message_count,command_count,ticket_closes,moderation_actions,last_active_at) VALUES(?,?,0,0,1,0,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET ticket_closes=ticket_closes+1,last_active_at=excluded.last_active_at').run(guildId, userId, now);
    db_js_1.db.prepare("INSERT INTO staff_activity_events(guild_id,user_id,event_type,detail,created_at) VALUES(?,?, 'ticket_close', '', ?)").run(guildId, userId, now);
}
function getStaffActivity(guildId, userId, windowDays = 30) {
    const row = activityRow(guildId, userId);
    const since = Date.now() - Math.max(1, Number(windowDays)) * 86_400_000;
    const cases = db_js_1.db.prepare("SELECT COUNT(*) AS count FROM cases WHERE guild_id=? AND moderator_id=? AND created_at>=? AND type NOT IN ('UNTIMEOUT','UNBAN','UNJAIL')").get(guildId, userId, since).count;
    const tickets = db_js_1.db.prepare('SELECT COALESCE(SUM(closes),0) AS count FROM ticket_stats WHERE guild_id=? AND user_id=?').get(guildId, userId).count;
    const effectiveTickets = Math.max(Number(row.ticket_closes || 0), Number(tickets || 0));
    const effectiveModeration = Math.max(Number(row.moderation_actions || 0), Number(cases || 0));
    return {
        ...row,
        moderation_actions: effectiveModeration,
        ticket_closes: effectiveTickets,
        total_actions: Number(row.message_count || 0) + Number(row.command_count || 0) + effectiveModeration + effectiveTickets
    };
}
function getCurrentCheck(guildId) {
    const row = db_js_1.db.prepare("SELECT * FROM staff_activity_checks WHERE guild_id=? AND status='open' ORDER BY sent_at DESC LIMIT 1").get(guildId);
    if (!row)
        return null;
    if (Number(row.expires_at) <= Date.now()) {
        closeCheck(row.id);
        return null;
    }
    return row;
}
function getCheckResponse(checkId, userId) {
    return db_js_1.db.prepare('SELECT * FROM staff_activity_responses WHERE check_id=? AND user_id=?').get(checkId, userId);
}
function closeCheck(checkId) {
    db_js_1.db.prepare("UPDATE staff_activity_checks SET status='closed', closed_at=? WHERE id=? AND status='open'").run(Date.now(), checkId);
}
function staffPool(guild, cfg) {
    const defaults = ensureStaffActivityConfig(cfg);
    const configuredStaffRoles = new Set(defaults.staffRoleIds.map(String).filter(Boolean));
    const excludedRoles = new Set(defaults.excludedRoleIds.map(String).filter(Boolean));
    const allStaff = [...guild.members.cache.values()].filter(member => {
        if (member.user.bot)
            return false;
        if (configuredStaffRoles.size)
            return [...member.roles.cache.keys()].some(id => configuredStaffRoles.has(id));
        return (0, core_js_1.isStaff)(member);
    });
    const excluded = allStaff.filter(member => [...member.roles.cache.keys()].some(id => excludedRoles.has(id)));
    const eligible = allStaff.filter(member => !excluded.some(excludedMember => excludedMember.id === member.id));
    return { allStaff, excluded, eligible };
}
function responseStats(guild, cfg, checkId) {
    const pool = staffPool(guild, cfg);
    const rows = db_js_1.db.prepare('SELECT user_id FROM staff_activity_responses WHERE check_id=?').all(checkId);
    const responseIds = new Set(rows.map(row => String(row.user_id)));
    const responded = pool.eligible.filter(member => responseIds.has(member.id));
    const missing = pool.eligible.filter(member => !responseIds.has(member.id));
    return { ...pool, responded, missing };
}
function publicCheckPayload(guild, check) {
    const cfg = (0, db_js_1.getGuildConfig)(guild.id);
    const defaults = ensureStaffActivityConfig(cfg);
    const stats = responseStats(guild, cfg, check.id);
    const ends = Math.floor(check.expires_at / 1000);
    const missingPreview = stats.missing.slice(0, 8).map(member => `${member}`).join('\n');
    const moreMissing = Math.max(0, stats.missing.length - 8);
    const roleNote = defaults.excludedRoleIds.length
        ? 'Members with an excluded staff role are not counted as missing.'
        : 'Every eligible staff member is expected to respond.';
    const description = `${defaults.panelDescription}

**Response Window**
Closes <t:${ends}:R>

${roleNote}`;
    const embed = (0, core_js_1.makeEmbed)({
        title: defaults.panelTitle,
        description,
        color: stats.missing.length === 0 ? config_js_1.config.brand.success : config_js_1.config.brand.primary,
        fields: [
            { name: 'Eligibility', value: `**${stats.eligible.length}** staff members`, inline: true },
            { name: 'Responded', value: `**${stats.responded.length}**`, inline: true },
            { name: 'Missing', value: `**${stats.missing.length}**`, inline: true },
            { name: 'Minimum Actions', value: `**${defaults.minimumActions}**`, inline: true },
            { name: 'Minimum Ticket Closes', value: `**${defaults.minimumTicketCloses}**`, inline: true },
            { name: 'Activity Window', value: `**${defaults.windowDays} days**`, inline: true },
            { name: 'Missing Staff', value: missingPreview ? `${missingPreview}${moreMissing ? `\n+ ${moreMissing} more` : ''}` : 'Everyone eligible has responded.', inline: false }
        ]
    });
    const label = `${defaults.buttonLabel} — ${stats.responded.length} Responded`.slice(0, 80);
    return {
        embeds: [embed],
        components: [new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`staffactivity:respond:${check.id}`).setLabel(label).setStyle(discord_js_1.ButtonStyle.Primary))]
    };
}
function closedAuditPayload(guild, cfg, check, stats) {
    const defaults = ensureStaffActivityConfig(cfg);
    const closedAt = Math.floor((check.closed_at ?? Date.now()) / 1000);
    const missingText = stats.missing.slice(0, 10).map(member => `${member}`).join('\n');
    const moreMissing = Math.max(0, stats.missing.length - 10);
    return {
        embeds: [(0, core_js_1.makeEmbed)({
                title: defaults.missingTitle,
                description: `Check #${check.id} closed <t:${closedAt}:R>.\n\n**Response Window**\n<t:${Math.floor(check.sent_at / 1000)}:F> → <t:${Math.floor(check.expires_at / 1000)}:F>`,
                color: stats.missing.length ? config_js_1.config.brand.warning : config_js_1.config.brand.success,
                fields: [
                    { name: 'Responded', value: `**${stats.responded.length}**`, inline: true },
                    { name: 'Missing', value: `**${stats.missing.length}**`, inline: true },
                    { name: 'Excluded', value: `**${stats.excluded.length}**`, inline: true },
                    { name: 'Eligible Staff', value: `**${stats.eligible.length}**`, inline: true },
                    { name: 'Missing Members', value: missingText ? `${missingText}${moreMissing ? `\n+ ${moreMissing} more` : ''}` : 'No missing staff members.', inline: false }
                ]
            })]
    };
}
async function updateCheckMessage(client, guild, check) {
    const channel = guild.channels.cache.get(check.channel_id);
    if (!channel?.isTextBased() || !check.message_id)
        return;
    const message = await channel.messages.fetch(check.message_id).catch(() => null);
    if (!message)
        return;
    const cfg = (0, db_js_1.getGuildConfig)(guild.id);
    if (check.status === 'closed') {
        const stats = responseStats(guild, cfg, check.id);
        await message.edit(closedAuditPayload(guild, cfg, check, stats)).catch(() => { });
    }
    else {
        await message.edit(publicCheckPayload(guild, check)).catch(() => { });
    }
}
async function sendCheckToChannel(guild, channel, cfg) {
    const defaults = ensureStaffActivityConfig(cfg);
    const sentAt = Date.now();
    const responseWindowHours = Math.max(1, Number(defaults.responseWindowHours) || 48);
    const expiresAt = sentAt + responseWindowHours * 3_600_000;
    const draft = db_js_1.db.prepare('INSERT INTO staff_activity_checks(guild_id,channel_id,sent_at,expires_at,status) VALUES(?,?,?,?,?)').run(guild.id, channel.id, sentAt, expiresAt, 'open');
    const checkId = Number(draft.lastInsertRowid);
    let check = db_js_1.db.prepare('SELECT * FROM staff_activity_checks WHERE id=?').get(checkId);
    try {
        const payload = publicCheckPayload(guild, check);
        if (defaults.mentionRoleId)
            payload.content = `<@&${defaults.mentionRoleId}>`;
        const message = await channel.send(payload);
        db_js_1.db.prepare('UPDATE staff_activity_checks SET message_id=? WHERE id=?').run(message.id, checkId);
        if (defaults.automaticPin)
            await message.pin().catch(() => { });
        check = db_js_1.db.prepare('SELECT * FROM staff_activity_checks WHERE id=?').get(checkId);
        return check;
    }
    catch (error) {
        db_js_1.db.prepare('DELETE FROM staff_activity_responses WHERE check_id=?').run(checkId);
        db_js_1.db.prepare('DELETE FROM staff_activity_checks WHERE id=?').run(checkId);
        throw error;
    }
}
async function sendStaffActivityPanelToChannel(guild, channel) {
    if (!guild || !channel?.isTextBased?.() || channel.guild?.id !== guild.id)
        throw new Error('Choose a text channel in this server for the staff activity panel.');
    const cfg = (0, db_js_1.getGuildConfig)(guild.id);
    const check = await sendCheckToChannel(guild, channel, cfg);
    return { ...check, channel_id: channel.id };
}
async function sendStaffActivityPanel(interaction) {
    const cfg = (0, db_js_1.getGuildConfig)(interaction.guildId);
    const defaults = ensureStaffActivityConfig(cfg);
    const requestedChannelId = interaction.options?.getChannel?.('channel')?.id;
    const channel = interaction.guild.channels.cache.get(requestedChannelId || defaults.channelId) || interaction.channel;
    const check = await sendStaffActivityPanelToChannel(interaction.guild, channel);
    return (0, core_js_1.safeReply)(interaction, { content: `Staff activity check sent to <#${channel.id}>: https://discord.com/channels/${interaction.guildId}/${channel.id}/${check.message_id}`, ephemeral: true });
}
async function sendScheduledStaffActivityChecks(client) {
    for (const guild of client.guilds.cache.values()) {
        const cfg = (0, db_js_1.getGuildConfig)(guild.id);
        const defaults = ensureStaffActivityConfig(cfg);
        const open = db_js_1.db.prepare("SELECT * FROM staff_activity_checks WHERE guild_id=? AND status='open' ORDER BY sent_at DESC LIMIT 1").get(guild.id);
        if (open && Number(open.expires_at) <= Date.now()) {
            const stats = responseStats(guild, cfg, open.id);
            closeCheck(open.id);
            const closed = db_js_1.db.prepare('SELECT * FROM staff_activity_checks WHERE id=?').get(open.id);
            if (closed)
                await updateCheckMessage(client, guild, closed);
            const auditChannel = guild.channels.cache.get(defaults.channelId || open.channel_id);
            if (auditChannel?.isTextBased())
                await auditChannel.send(closedAuditPayload(guild, cfg, closed ?? open, stats)).catch(() => { });
        }
        if (!defaults.enabled || !defaults.autoSendEnabled || !defaults.channelId)
            continue;
        const last = db_js_1.db.prepare('SELECT * FROM staff_activity_checks WHERE guild_id=? ORDER BY sent_at DESC LIMIT 1').get(guild.id);
        const intervalMs = Math.max(1, Number(defaults.intervalHours) || 168) * 3_600_000;
        if (last && Date.now() - Number(last.sent_at) < intervalMs)
            continue;
        const channel = guild.channels.cache.get(defaults.channelId);
        if (!channel?.isTextBased())
            continue;
        await sendCheckToChannel(guild, channel, cfg).catch(error => console.warn(`[Auralis] staff activity ${guild.id}: ${(0, core_js_1.cleanError)(error)}`));
    }
}
async function respondToStaffActivity(interaction, checkId) {
    const check = db_js_1.db.prepare("SELECT * FROM staff_activity_checks WHERE id=? AND guild_id=? AND status='open'").get(checkId, interaction.guildId);
    if (!check)
        return (0, core_js_1.safeReply)(interaction, { content: 'This staff activity check is no longer active.', ephemeral: true });
    if (Number(check.expires_at) <= Date.now()) {
        closeCheck(check.id);
        return (0, core_js_1.safeReply)(interaction, { content: 'This staff activity check has expired.', ephemeral: true });
    }
    const cfg = (0, db_js_1.getGuildConfig)(interaction.guildId);
    const defaults = ensureStaffActivityConfig(cfg);
    const pool = staffPool(interaction.guild, cfg);
    if (!pool.eligible.some(member => member.id === interaction.user.id)) {
        return (0, core_js_1.safeReply)(interaction, { content: 'This check is only for eligible staff members.', ephemeral: true });
    }
    const existing = getCheckResponse(check.id, interaction.user.id);
    if (!existing) {
        db_js_1.db.prepare('INSERT INTO staff_activity_responses(check_id,guild_id,user_id,responded_at) VALUES(?,?,?,?)').run(check.id, interaction.guildId, interaction.user.id, Date.now());
    }
    const now = Math.floor(Date.now() / 1000);
    const description = existing
        ? 'Your response was already recorded for this activity check.'
        : `${defaults.confirmedDescription}\n\nResponse recorded <t:${now}:R>.`;
    await (0, core_js_1.safeReply)(interaction, {
        embeds: [(0, core_js_1.makeEmbed)({ title: defaults.confirmedTitle, description, color: config_js_1.config.brand.success })],
        ephemeral: true
    });
    const refreshed = db_js_1.db.prepare('SELECT * FROM staff_activity_checks WHERE id=?').get(check.id);
    if (refreshed)
        await updateCheckMessage(interaction.client, interaction.guild, refreshed);
}
async function showStaffActivity(interaction, member = interaction.member) {
    if (!interaction.guildId)
        return (0, core_js_1.safeReply)(interaction, { content: 'This feature is server-only.', ephemeral: true });
    return (0, core_js_1.safeReply)(interaction, buildStaffActivityPayload(interaction.guildId, member));
}
function buildStaffActivityPayload(guildId, member) {
    const cfg = (0, db_js_1.getGuildConfig)(guildId);
    const defaults = ensureStaffActivityConfig(cfg);
    const activity = getStaffActivity(guildId, member.id, defaults.windowDays);
    const current = getCurrentCheck(guildId);
    const response = current ? getCheckResponse(current.id, member.id) : null;
    const last = activity.last_active_at ? (0, core_js_1.relativeTime)(activity.last_active_at) : 'No recent activity';
    const state = response
        ? 'Confirmed'
        : (!defaults.enabled
            ? 'Disabled'
            : (activity.total_actions >= defaults.minimumActions && activity.ticket_closes >= defaults.minimumTicketCloses ? 'Active' : 'Needs Activity'));
    return {
        embeds: [(0, core_js_1.makeEmbed)({
                title: 'Staff Activity',
                description: `${member}\n\n**Status**\n${state}\n\n${current ? (response ? 'You are marked as active for the current check.' : `Response required by <t:${Math.floor(current.expires_at / 1000)}:R>.`) : 'No active check.'}`,
                color: state === 'Confirmed' || state === 'Active' ? config_js_1.config.brand.success : state === 'Needs Activity' ? config_js_1.config.brand.warning : config_js_1.config.brand.neutral,
                fields: [
                    { name: 'Messages', value: `**${Number(activity.message_count || 0)}**`, inline: true },
                    { name: 'Commands', value: `**${Number(activity.command_count || 0)}**`, inline: true },
                    { name: 'Moderation', value: `**${Number(activity.moderation_actions || 0)}**`, inline: true },
                    { name: 'Ticket Closes', value: `**${Number(activity.ticket_closes || 0)}**`, inline: true },
                    { name: 'Minimum Actions', value: `**${defaults.minimumActions}**`, inline: true },
                    { name: 'Minimum Ticket Closes', value: `**${defaults.minimumTicketCloses}**`, inline: true },
                    { name: 'Last Activity', value: `**${last}**`, inline: false }
                ]
            })]
    };
}
function staffActivityLeaderboard(guildId, page = 1) {
    const rows = db_js_1.db.prepare('SELECT user_id, message_count, command_count, ticket_closes, moderation_actions, last_active_at FROM staff_activity WHERE guild_id=? ORDER BY (ticket_closes + moderation_actions + command_count) DESC, last_active_at DESC').all(guildId);
    return (0, core_js_1.pageSlice)(rows, page, 10);
}

});
__factories.set("src/systems/tickets.js", function(exports, require, module, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTicketPanels = getTicketPanels;
exports.getTicketPanel = getTicketPanel;
exports.buildTicketPanelMessage = buildTicketPanelMessage;
exports.ticketPanel = ticketPanel;
exports.sendTicketPanel = sendTicketPanel;
exports.openTicketCreation = openTicketCreation;
exports.submitTicketCreation = submitTicketCreation;
exports.createTicket = createTicket;
exports.claimTicket = claimTicket;
exports.closeTicket = closeTicket;
exports.openTickets = openTickets;
exports.ticketLeaderboard = ticketLeaderboard;
exports.addTicketUser = addTicketUser;
exports.removeTicketUser = removeTicketUser;
const discord_js_1 = require("discord.js");
const db_js_1 = require("../db.js");
const config_js_1 = require("../config.js");
const core_js_1 = require("../lib/core.js");
const staff_activity_js_1 = require("./staff-activity.js");
const BUTTON_STYLES = { PRIMARY: discord_js_1.ButtonStyle.Primary, SECONDARY: discord_js_1.ButtonStyle.Secondary, SUCCESS: discord_js_1.ButtonStyle.Success, DANGER: discord_js_1.ButtonStyle.Danger };
const COMPONENT_TYPES = new Set(['button', 'link', 'string_select', 'user_select', 'role_select', 'channel_select', 'mentionable_select']);
function normalizeComponent(component, index) {
    const c = { ...(component || {}) };
    c.id = String(c.id || `component-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
    c.type = String(c.type || 'button').toLowerCase();
    c.row = Math.max(0, Math.min(4, Number(c.row ?? 0)));
    return c;
}
function getTicketPanels(guildId) {
    const cfg = (0, db_js_1.getGuildConfig)(guildId);
    return Array.isArray(cfg.ticketDefaults.panels) ? cfg.ticketDefaults.panels : structuredClone(config_js_1.config.ticketDefaults.panels);
}
function getTicketPanel(guildId, panelId = 'default') {
    const panels = getTicketPanels(guildId);
    return panels.find(panel => String(panel.id) === String(panelId) || String(panel.name || '').toLowerCase() === String(panelId).toLowerCase()) || (String(panelId) === 'default' ? panels[0] : null) || null;
}
function componentId(panelId, componentIdValue) {
    return `tpanel:${panelId}:${componentIdValue}`.slice(0, 100);
}
function buildButton(component, panelId) {
    const button = new discord_js_1.ButtonBuilder();
    if (component.type === 'link') {
        let url = 'https://discord.com';
        try {
            const parsed = new URL(String(component.url || ''));
            if (['http:', 'https:'].includes(parsed.protocol))
                url = parsed.toString();
        }
        catch { }
        button.setStyle(discord_js_1.ButtonStyle.Link).setURL(url.slice(0, 512));
        const label = String(component.label ?? '').trim().slice(0, 80);
        const emoji = (0, core_js_1.safeComponentEmoji)(component.emoji);
        if (label)
            button.setLabel(label);
        if (emoji)
            button.setEmoji(emoji);
        if (!label && !emoji)
            button.setLabel('Open Link');
    }
    else {
        button.setCustomId(componentId(panelId, component.id));
        button.setStyle(BUTTON_STYLES[String(component.style || 'SECONDARY').toUpperCase()] ?? discord_js_1.ButtonStyle.Secondary);
        const label = String(component.label ?? '').trim().slice(0, 80);
        const emoji = (0, core_js_1.safeComponentEmoji)(component.emoji);
        if (label)
            button.setLabel(label);
        if (emoji)
            button.setEmoji(emoji);
        if (!label && !emoji)
            button.setLabel('Open Ticket');
    }
    if (component.disabled)
        button.setDisabled(true);
    return button;
}
function buildSelect(component, panelId) {
    const id = componentId(panelId, component.id);
    const placeholder = String(component.placeholder || 'Choose an option').slice(0, 150);
    if (component.type === 'string_select') {
        const rawOptions = Array.isArray(component.options) ? component.options : [];
        const optionLimit = Math.max(1, Math.min(25, rawOptions.length || 1));
        let minValues = Math.max(0, Math.min(optionLimit, Number(component.minValues ?? 1)));
        let maxValues = Math.max(1, Math.min(optionLimit, Number(component.maxValues ?? 1)));
        if (maxValues < minValues)
            maxValues = minValues;
        const menu = new discord_js_1.StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).setMinValues(minValues).setMaxValues(maxValues);
        const options = rawOptions.slice(0, 25).map((option, i) => {
            const b = new discord_js_1.StringSelectMenuOptionBuilder().setLabel(String(option.label || `Option ${i + 1}`).slice(0, 100)).setValue(String(option.value || `option-${i + 1}`).slice(0, 100));
            if (option.description)
                b.setDescription(String(option.description).slice(0, 100));
            const emoji = (0, core_js_1.safeComponentEmoji)(option.emoji);
            if (emoji)
                b.setEmoji(emoji);
            if (option.default)
                b.setDefault(true);
            return b;
        });
        if (!options.length)
            options.push(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Support').setValue('support'));
        return menu.addOptions(options);
    }
    let minValues = Math.max(0, Math.min(25, Number(component.minValues ?? 1)));
    let maxValues = Math.max(1, Math.min(25, Number(component.maxValues ?? 1)));
    if (maxValues < minValues)
        maxValues = minValues;
    const common = menu => menu.setCustomId(id).setPlaceholder(placeholder).setMinValues(minValues).setMaxValues(maxValues);
    if (component.type === 'user_select')
        return common(new discord_js_1.UserSelectMenuBuilder());
    if (component.type === 'role_select')
        return common(new discord_js_1.RoleSelectMenuBuilder());
    if (component.type === 'channel_select')
        return common(new discord_js_1.ChannelSelectMenuBuilder());
    return common(new discord_js_1.MentionableSelectMenuBuilder());
}
function buildTicketPanelMessage(guildId, panelId = 'default') {
    const panel = getTicketPanel(guildId, panelId);
    if (!panel)
        throw new Error('Ticket panel not found.');
    const components = (Array.isArray(panel.components) ? panel.components : []).map(normalizeComponent).filter(c => COMPONENT_TYPES.has(c.type));
    const rows = [];
    for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
        const rowComponents = components.filter(c => c.row === rowIndex).slice(0, 5);
        if (!rowComponents.length)
            continue;
        const row = new discord_js_1.ActionRowBuilder();
        for (const component of rowComponents) {
            if (['button', 'link'].includes(component.type))
                row.addComponents(buildButton(component, panel.id));
            else
                row.addComponents(buildSelect(component, panel.id));
        }
        rows.push(row);
    }
    return {
        content: panel.content ? String(panel.content).slice(0, 2000) : undefined,
        embeds: [(0, core_js_1.makeEmbed)({ title: panel.title || 'Support Center', description: panel.description || '', color: panel.color || config_js_1.config.brand.primary })],
        components: rows
    };
}
function ticketPanel() {
    const panel = config_js_1.config.ticketDefaults.panels?.[0];
    if (!panel)
        return null;
    const rows = (Array.isArray(panel.components) ? panel.components : []).filter(c => Number(c.row ?? 0) === 0).slice(0, 5);
    const row = new discord_js_1.ActionRowBuilder();
    for (const component of rows) {
        if (['button', 'link'].includes(component.type))
            row.addComponents(buildButton(component, panel.id));
        else
            row.addComponents(buildSelect(component, panel.id));
    }
    return row;
}
async function sendTicketPanel(channel, guildId, panelId = 'default') {
    const payload = buildTicketPanelMessage(guildId, panelId);
    const sent = await channel.send(payload);
    return sent;
}
async function openTicketCreation(interaction, type) {
    const cfg = (0, db_js_1.getGuildConfig)(interaction.guildId);
    const form = cfg.ticketDefaults?.creationForm ?? {};
    const questions = Array.isArray(form.questions) ? form.questions.slice(0, 5) : [];
    if (form.enabled !== true || !questions.length)
        return createTicket(interaction, type);
    const modal = new discord_js_1.ModalBuilder().setCustomId(`ticket:create-submit:${String(type || 'support').slice(0, 40)}`).setTitle(String(form.title || 'New support ticket').slice(0, 45));
    modal.addComponents(...questions.map((question, index) => {
        const input = new discord_js_1.TextInputBuilder()
            .setCustomId(`answer_${index + 1}`)
            .setLabel(String(question.label || `Question ${index + 1}`).slice(0, 45))
            .setStyle(question.style === 'short' ? discord_js_1.TextInputStyle.Short : discord_js_1.TextInputStyle.Paragraph)
            .setRequired(question.required !== false)
            .setMaxLength(Math.max(1, Math.min(1000, Number(question.maxLength) || 500)));
        if (question.placeholder)
            input.setPlaceholder(String(question.placeholder).slice(0, 100));
        return new discord_js_1.ActionRowBuilder().addComponents(input);
    }));
    return interaction.showModal(modal);
}
async function submitTicketCreation(interaction, type) {
    const cfg = (0, db_js_1.getGuildConfig)(interaction.guildId);
    const questions = (Array.isArray(cfg.ticketDefaults?.creationForm?.questions) ? cfg.ticketDefaults.creationForm.questions : []).slice(0, 5);
    const answers = questions.map((question, index) => ({
        label: String(question.label || `Question ${index + 1}`).slice(0, 45),
        value: String(interaction.fields.getTextInputValue(`answer_${index + 1}`) || '').trim().slice(0, 1000)
    })).filter(answer => answer.value);
    return createTicket(interaction, type, answers);
}
async function createTicket(interaction, type, answers = []) {
    const guild = interaction.guild;
    const cfg = (0, db_js_1.getGuildConfig)(guild.id);
    const typeCollection = cfg.ticketDefaults.types ?? cfg.ticketDefaults.categories ?? {};
    const ticketType = typeCollection[type] ? type : Object.keys(typeCollection)[0] ?? 'support';
    const openCount = db_js_1.db.prepare("SELECT COUNT(*) AS count FROM tickets WHERE guild_id=? AND opener_id=? AND status='open'").get(guild.id, interaction.user.id).count;
    if (openCount >= (cfg.ticketDefaults.maxOpenPerUser ?? 2))
        return (0, core_js_1.safeReply)(interaction, { content: cfg.messages.ticketLimit, ephemeral: true });
    await (0, core_js_1.deferEphemeral)(interaction);
    const baseName = (cfg.ticketDefaults.naming ?? 'ticket-{number}').replace('{number}', String(db_js_1.db.prepare('SELECT COALESCE(MAX(id),0)+1 AS n FROM tickets').get().n)).replace('{type}', ticketType).replace('{user}', interaction.user.username.toLowerCase());
    const name = baseName.replace(/[^a-z0-9-_]/gi, '-').slice(0, 90);
    const permissionOverwrites = [
        { id: guild.roles.everyone.id, deny: [discord_js_1.PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory] }
    ];
    for (const roleId of cfg.ticketDefaults.supportRoleIds ?? [])
        permissionOverwrites.push({ id: roleId, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory] });
    const channel = await guild.channels.create({ name, type: discord_js_1.ChannelType.GuildText, parent: cfg.ticketDefaults.categoryId || undefined, permissionOverwrites, topic: `Auralis ticket — ${ticketType} — ${interaction.user.id}` });
    db_js_1.db.prepare('INSERT INTO tickets(guild_id,channel_id,opener_id,type,created_at,data) VALUES(?,?,?,?,?,?)').run(guild.id, channel.id, interaction.user.id, ticketType, Date.now(), JSON.stringify({ answers: Array.isArray(answers) ? answers : [] }));
    const ticketButtons = [];
    if (cfg.ticketDefaults.claimEnabled !== false) {
        ticketButtons.push(new discord_js_1.ButtonBuilder().setCustomId('ticket:claim').setLabel(cfg.ticketDefaults.buttonLabels?.claim ?? 'Claim').setStyle(discord_js_1.ButtonStyle.Success));
    }
    ticketButtons.push(new discord_js_1.ButtonBuilder().setCustomId('ticket:add').setLabel(cfg.ticketDefaults.buttonLabels?.add ?? 'Add').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId('ticket:remove').setLabel(cfg.ticketDefaults.buttonLabels?.remove ?? 'Remove').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId('ticket:close').setLabel(cfg.ticketDefaults.buttonLabels?.close ?? 'Close').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId('ticket:close-reason').setLabel(cfg.ticketDefaults.buttonLabels?.closeWithReason ?? 'Close with reason').setStyle(discord_js_1.ButtonStyle.Secondary));
    const row = new discord_js_1.ActionRowBuilder().addComponents(ticketButtons);
    const questionFields = (Array.isArray(answers) ? answers : []).slice(0, 5).map(answer => ({ name: String(answer.label || 'Details').slice(0, 256), value: (0, core_js_1.truncate)(String(answer.value || 'No answer provided.'), 1024), inline: false }));
    await channel.send({ content: `<@${interaction.user.id}>`, embeds: [(0, core_js_1.makeEmbed)({ title: (cfg.ticketDefaults.types ?? cfg.ticketDefaults.categories)?.[ticketType]?.label ?? 'Support', description: 'A staff member will be with you shortly.\nKeep all relevant details in this channel.', fields: questionFields })], components: [row] });
    const ticketLogging = cfg.loggingDefaults?.enabled !== false && cfg.loggingDefaults?.events?.tickets !== false;
    const createLogChannelId = cfg.ticketDefaults.logChannelId || cfg.loggingDefaults?.channels?.tickets;
    if (ticketLogging && createLogChannelId) {
        const target = guild.channels.cache.get(String(createLogChannelId));
        if (target?.isTextBased())
            target.send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Ticket created', description: `${channel} — ${interaction.user} — ${ticketType}\nOpener ID: ${interaction.user.id}`, color: config_js_1.config.brand.info })] }).catch(() => { });
    }
    return interaction.editReply({ content: `${cfg.messages.ticketCreated} ${channel}` });
}
async function claimTicket(channel, member) {
    const ticket = db_js_1.db.prepare("SELECT * FROM tickets WHERE channel_id=? AND status='open'").get(channel.id);
    if (!ticket)
        return { ok: false, message: 'This is not an open Auralis ticket.' };
    const cfg = (0, db_js_1.getGuildConfig)(channel.guild.id);
    const staffRoleIds = [...(cfg.ticketDefaults.supportRoleIds ?? []), ...(cfg.ticketDefaults.managerRoleIds ?? [])].map(String);
    const hasStaffRole = staffRoleIds.some(roleId => member?.roles?.cache?.has(roleId));
    if (!(0, core_js_1.isStaff)(member) && !hasStaffRole)
        return { ok: false, message: 'Only configured ticket staff can claim this ticket.' };
    let data = {};
    try {
        data = JSON.parse(ticket.data || '{}');
    }
    catch { }
    if (data.claimedBy && String(data.claimedBy) !== String(member.id)) {
        return { ok: false, message: `This ticket is already being handled by <@${data.claimedBy}>.` };
    }
    if (String(data.claimedBy || '') === String(member.id))
        return { ok: true, message: 'You are already handling this ticket.' };
    data.claimedBy = String(member.id);
    data.claimedAt = Date.now();
    db_js_1.db.prepare("UPDATE tickets SET data=? WHERE channel_id=? AND status='open'").run(JSON.stringify(data), channel.id);
    await channel.send({ content: `This ticket is now being handled by <@${member.id}>.` });
    const logChannelId = cfg.ticketDefaults.logChannelId || cfg.loggingDefaults?.channels?.tickets;
    const logChannel = logChannelId ? channel.guild.channels.cache.get(String(logChannelId)) : null;
    if (cfg.loggingDefaults?.enabled !== false && cfg.loggingDefaults?.events?.tickets !== false && logChannel?.isTextBased()) {
        await logChannel.send({ embeds: [(0, core_js_1.makeEmbed)({ title: 'Ticket claimed', description: `${channel} is now handled by <@${member.id}>.`, fields: [{ name: 'Ticket owner', value: `<@${ticket.opener_id}>`, inline: true }], timestamp: true })] }).catch(() => { });
    }
    return { ok: true, message: `You are now handling ${channel}.` };
}
async function closeTicket(channel, member, client, closeReason = '') {
    const ticket = db_js_1.db.prepare("SELECT * FROM tickets WHERE channel_id=? AND status='open'").get(channel.id);
    if (!ticket)
        return { ok: false, message: 'This is not an open Auralis ticket.' };
    const cfg = (0, db_js_1.getGuildConfig)(channel.guild.id);
    const staffRoleIds = [...(cfg.ticketDefaults.supportRoleIds ?? []), ...(cfg.ticketDefaults.managerRoleIds ?? [])];
    const staffCanManage = (0, core_js_1.isStaff)(member) || staffRoleIds.some(id => member?.roles?.cache?.has(String(id)));
    const isOpener = String(member?.id) === String(ticket.opener_id);
    if (!staffCanManage && !isOpener)
        return { ok: false, message: 'You cannot close this ticket.' };
    if (isOpener && !staffCanManage && cfg.ticketDefaults.allowUserClose === false) {
        return { ok: false, message: 'Ticket owners are not allowed to close tickets in this server. Please contact the support team.' };
    }
    const closeTimestamp = Date.now();
    let ticketData = {};
    try {
        ticketData = JSON.parse(ticket.data || '{}');
    }
    catch { }
    if (String(closeReason || '').trim())
        ticketData.closeReason = String(closeReason).trim().slice(0, 1000);
    db_js_1.db.prepare("UPDATE tickets SET status='closed',closed_at=?,closed_by=?,data=? WHERE channel_id=? AND status='open'").run(closeTimestamp, member.id, JSON.stringify(ticketData), channel.id);
    if (staffCanManage) {
        (0, staff_activity_js_1.recordTicketClose)(channel.guild.id, member.id);
        db_js_1.db.prepare('INSERT INTO ticket_stats(guild_id,user_id,closes) VALUES(?,?,1) ON CONFLICT(guild_id,user_id) DO UPDATE SET closes=closes+1').run(channel.guild.id, member.id);
    }
    let transcriptText = '';
    let transcriptAttachment = null;
    if (cfg.ticketDefaults.autoTranscript !== false) {
        const maxMessages = Math.max(1, Math.min(500, Number(config_js_1.config.limits.maxTranscriptMessages) || 500));
        const collected = [];
        let before;
        while (collected.length < maxMessages) {
            const batch = await channel.messages.fetch({ limit: Math.min(100, maxMessages - collected.length), ...(before ? { before } : {}) }).catch(() => null);
            if (!batch?.size)
                break;
            collected.push(...batch.values());
            const oldest = batch.last();
            if (!oldest || batch.size < 100 || collected.length >= maxMessages)
                break;
            before = oldest.id;
        }
        const messages = collected.reverse();
        const lines = messages.map(message => {
            const timestamp = new Date(message.createdTimestamp).toISOString();
            const body = String(message.cleanContent || '').trim();
            const attachments = [...(message.attachments?.values?.() ?? [])].map(item => item.url).join(' ');
            const embeds = message.embeds?.length ? `[${message.embeds.length} embed(s)]` : '';
            return `[${timestamp}] ${message.author?.tag ?? message.author?.username ?? 'Unknown user'}: ${body || '[no text]'}${attachments ? `\nAttachments: ${attachments}` : ''}${embeds ? `\n${embeds}` : ''}`;
        });
        transcriptText = (0, core_js_1.truncate)(lines.join('\n\n') || 'No messages were available for this transcript.', 900000);
        transcriptAttachment = new discord_js_1.AttachmentBuilder(Buffer.from(transcriptText, 'utf8'), { name: `ticket-${channel.id}-transcript.txt` });
        const transcriptChannel = cfg.ticketDefaults.transcriptChannelId
            ? await channel.guild.channels.fetch(cfg.ticketDefaults.transcriptChannelId).catch(() => null)
            : null;
        if (transcriptChannel?.isTextBased()) {
            await transcriptChannel.send({
                embeds: [(0, core_js_1.makeEmbed)({
                        title: cfg.ticketDefaults.transcriptTitle || 'Ticket Transcript',
                        description: `Ticket: **#${channel.name}**\nType: **${ticket.type}**\nOpened by: <@${ticket.opener_id}>\nClosed by: <@${member.id}>\n${ticketData.closeReason ? `Close reason: ${(0, core_js_1.truncate)(ticketData.closeReason, 700)}\n` : ''}Messages included: **${messages.length}**`,
                        color: config_js_1.config.brand.neutral
                    })],
                files: [new discord_js_1.AttachmentBuilder(Buffer.from(transcriptText, 'utf8'), { name: `ticket-${channel.id}-transcript.txt` })]
            }).catch(error => console.warn(`[Auralis] ticket transcript delivery failed for ${channel.id}: ${error?.message ?? error}`));
        }
    }
    const opener = await client.users.fetch(ticket.opener_id).catch(() => null);
    let dmSent = false;
    const dmEnabled = cfg.ticketDefaults.closeDmEnabled !== false;
    if (opener && dmEnabled) {
        const raw = String(cfg.ticketDefaults.closeDmMessage || 'Your ticket in {server} has been closed by {closedBy}. If you still need help, you can open a new ticket.');
        const closeMessage = raw
            .replaceAll('{server}', String(channel.guild.name))
            .replaceAll('{ticket}', `#${channel.name}`)
            .replaceAll('{ticketType}', String(ticket.type))
            .replaceAll('{closedBy}', String(member.user?.tag ?? member.user?.username ?? member.id))
            .replaceAll('{channelId}', String(channel.id))
            .replaceAll('{closeReason}', String(ticketData.closeReason || 'No closing reason provided.'));
        const dmFiles = cfg.ticketDefaults.dmTranscriptOnClose && transcriptText ? [new discord_js_1.AttachmentBuilder(Buffer.from(transcriptText, 'utf8'), { name: `ticket-${channel.id}-transcript.txt` })] : [];
        try {
            await opener.send({
                embeds: [(0, core_js_1.makeEmbed)({ title: cfg.ticketDefaults.closeDmTitle || 'Ticket Closed', description: closeMessage, color: config_js_1.config.brand.info })],
                ...(dmFiles.length ? { files: dmFiles } : {})
            });
            dmSent = true;
        }
        catch (error) {
            console.warn(`[Auralis] ticket close DM could not be delivered to ${ticket.opener_id}: ${error?.message ?? error}`);
        }
    }
    const ticketLogging = cfg.loggingDefaults?.enabled !== false && cfg.loggingDefaults?.events?.tickets !== false;
    const logChannelId = cfg.ticketDefaults.logChannelId || cfg.loggingDefaults?.channels?.tickets;
    if (ticketLogging && logChannelId) {
        const logChannel = await channel.guild.channels.fetch(logChannelId).catch(() => null);
        if (logChannel?.isTextBased()) {
            await logChannel.send({ embeds: [(0, core_js_1.makeEmbed)({
                        title: cfg.ticketDefaults.closeLogTitle || 'Ticket Closed',
                        description: `Ticket: **#${channel.name}**\nType: **${ticket.type}**\nOpened by: <@${ticket.opener_id}>\nClosed by: <@${member.id}>\n${ticketData.closeReason ? `Close reason: ${(0, core_js_1.truncate)(ticketData.closeReason, 700)}\n` : ''}Transcript: **${transcriptAttachment ? 'Generated' : 'Disabled or unavailable'}**`,
                        color: config_js_1.config.brand.warning
                    })] }).catch(() => { });
        }
    }
    const closeDelayMs = Math.max(0, Math.min(60, Number(cfg.ticketDefaults.closeDelaySeconds ?? 3))) * 1000;
    const channelId = channel.id;
    setTimeout(() => {
        void channel.delete('Auralis ticket closed').catch(error => console.warn(`[Auralis] ticket channel deletion failed for ${channelId}: ${error?.message ?? error}`));
    }, closeDelayMs).unref?.();
    const staffCloses = staffCanManage ? db_js_1.db.prepare('SELECT closes FROM ticket_stats WHERE guild_id=? AND user_id=?').get(channel.guild.id, member.id)?.closes ?? 0 : 0;
    return { ok: true, count: staffCloses, transcript: Boolean(transcriptAttachment), dmSent, dmEnabled };
}
function openTickets(guildId) { return db_js_1.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND status='open' ORDER BY created_at DESC").all(guildId); }
function ticketLeaderboard(guildId, limit = 10) { return db_js_1.db.prepare('SELECT user_id, closes FROM ticket_stats WHERE guild_id=? ORDER BY closes DESC LIMIT ?').all(guildId, limit); }
async function addTicketUser(channel, userId) { const ticket = db_js_1.db.prepare("SELECT * FROM tickets WHERE channel_id=? AND status='open'").get(channel.id); if (!ticket)
    return false; await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); return true; }
async function removeTicketUser(channel, userId) { await channel.permissionOverwrites.delete(userId).catch(() => { }); return true; }

});
__factories.set("src/systems/welcome.js", function(exports, require, module, __filename, __dirname) {
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderWelcomeImage = renderWelcomeImage;
exports.welcomeText = welcomeText;
exports.sendWelcome = sendWelcome;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const sharp_1 = __importDefault(require("sharp"));
const discord_js_1 = require("discord.js");
const db_js_1 = require("../db.js");
const core_js_1 = require("../lib/core.js");
const avatarCache = new Map();
const assetMime = new Map([['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.gif', 'image/gif']]);
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || min)); }
function esc(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function hex(value, fallback = '#7C6CF5') {
    const raw = String(value ?? '').trim();
    if (/^#[0-9a-f]{6}$/i.test(raw))
        return raw;
    return fallback;
}
function alphaColor(value, opacity = 1) {
    const c = hex(value, '#000000').slice(1);
    const n = clamp(opacity, 0, 1);
    return `#${c}${Math.round(n * 255).toString(16).padStart(2, '0')}`;
}
function wrapLines(text, maxChars) {
    const words = String(text ?? '').split(/\s+/).filter(Boolean);
    if (!words.length)
        return [''];
    const lines = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (next.length > maxChars && line) {
            lines.push(line);
            line = word;
        }
        else
            line = next;
    }
    if (line)
        lines.push(line);
    return lines;
}
function ordinal(value) {
    const n = Math.abs(Number(value) || 0);
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13)
        return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][Math.min(n % 10, 3)] || 'th'}`;
}
function placeholderValues(member) {
    const guild = member.guild;
    const accountAgeDays = Math.max(0, Math.floor((Date.now() - member.user.createdTimestamp) / 86400000));
    return {
        user: member.toString(),
        user_mention: member.toString(),
        user_name: member.displayName,
        username: member.user.username,
        user_tag: member.user.tag,
        user_id: member.id,
        server: guild.name,
        server_name: guild.name,
        server_id: guild.id,
        member_count: guild.memberCount,
        server_member_count: guild.memberCount,
        member_number: guild.memberCount,
        member_ordinal: ordinal(guild.memberCount),
        account_age_days: accountAgeDays,
        user_created_at: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`,
        guild_created_at: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`
    };
}
async function assetBuffer(assetPath) { return promises_1.default.readFile(assetPath); }
async function getAvatarBuffer(member) {
    const key = member.user.id;
    const cached = avatarCache.get(key);
    if (cached && cached.expiresAt > Date.now())
        return cached.buffer;
    const url = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
    const response = await fetch(url).catch(() => null);
    if (!response?.ok)
        return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    avatarCache.set(key, { buffer, expiresAt: Date.now() + 10 * 60_000 });
    return buffer;
}
function dataImage(buffer, mime = 'image/png') { return `data:${mime};base64,${Buffer.from(buffer).toString('base64')}`; }
function circleClip(id, cx, cy, r) { return `<clipPath id="${esc(id)}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`; }
function roundedClip(id, x, y, w, h, r) { return `<clipPath id="${esc(id)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}"/></clipPath>`; }
async function imageElement(element, values, member, defs) {
    const x = Number(element.x) || 0, y = Number(element.y) || 0, w = Number(element.width) || 100, h = Number(element.height) || 100;
    let buffer = null, mime = 'image/png';
    if (element.type === 'avatar')
        buffer = await getAvatarBuffer(member);
    else if (element.assetId) {
        const asset = (0, db_js_1.getWelcomeAsset)(element.assetId, member.guild.id);
        if (asset?.file_path) {
            buffer = await assetBuffer(asset.file_path).catch(() => null);
            mime = asset.mime || mime;
        }
    }
    else if (element.assetPath) {
        buffer = await assetBuffer(element.assetPath).catch(() => null);
        mime = assetMime.get(node_path_1.default.extname(element.assetPath).toLowerCase()) || mime;
    }
    if (!buffer)
        return '';
    const id = `clip-${node_crypto_1.default.randomBytes(6).toString('hex')}`;
    const shape = String(element.shape || 'rounded').toLowerCase();
    let clip = '';
    if (shape === 'circle') {
        const r = Math.min(w, h) / 2;
        clip = circleClip(id, x + w / 2, y + h / 2, r);
    }
    else if (shape === 'rounded')
        clip = roundedClip(id, x, y, w, h, Number(element.radius) || 18);
    defs.push(clip);
    const opacity = clamp(element.opacity ?? 1, 0, 1);
    const href = dataImage(buffer, mime);
    const rotate = Number(element.rotation) || 0;
    return `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" opacity="${opacity}" clip-path="url(#${id})" transform="rotate(${rotate} ${x + w / 2} ${y + h / 2})"/>`;
}
async function renderElement(element, values, member, defs) {
    if (element.visible === false)
        return '';
    const type = String(element.type || 'text').toLowerCase();
    if (['image', 'avatar'].includes(type))
        return imageElement(element, values, member, defs);
    const x = Number(element.x) || 0, y = Number(element.y) || 0, w = Number(element.width) || 300, h = Number(element.height) || 100;
    const opacity = clamp(element.opacity ?? 1, 0, 1);
    const rotation = Number(element.rotation) || 0;
    if (type === 'shape') {
        const shape = String(element.shape || 'rect').toLowerCase();
        const fill = hex(element.fill, '#111111');
        const stroke = hex(element.stroke, '#ffffff');
        const sw = Math.max(0, Number(element.strokeWidth) || 0);
        if (shape === 'circle') {
            const r = Math.min(w, h) / 2;
            return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${r}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${sw}"/>`;
        }
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Number(element.radius) || 0}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${sw}" transform="rotate(${rotation} ${x + w / 2} ${y + h / 2})"/>`;
    }
    if (type === 'line') {
        return `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" stroke="${hex(element.color, '#ffffff')}" stroke-opacity="${opacity}" stroke-width="${Math.max(1, Number(element.strokeWidth) || 2)}"/>`;
    }
    const content = (0, core_js_1.replacePlaceholders)(element.content ?? '', values);
    const fontSize = Math.max(8, Number(element.fontSize) || 32);
    const maxChars = Math.max(8, Math.floor(w / (fontSize * 0.58)));
    const lines = Array.isArray(element.lines) ? element.lines : wrapLines(content, maxChars).slice(0, Math.max(1, Math.floor(h / (fontSize * 1.2))));
    const color = hex(element.color, '#ffffff');
    const fontFamily = esc(element.fontFamily || 'Arial');
    const fontWeight = String(element.fontWeight || 600).replace(/[^0-9]/g, '') || 600;
    const anchor = element.align === 'center' ? 'middle' : element.align === 'right' ? 'end' : 'start';
    const tx = anchor === 'middle' ? x + w / 2 : anchor === 'end' ? x + w : x;
    const baseline = Math.max(fontSize, y + fontSize);
    const shadow = element.shadow === false ? '' : 'paint-order:stroke fill;stroke:#00000080;stroke-width:4px;';
    const spans = lines.map((line, i) => `<tspan x="${tx}" dy="${i === 0 ? 0 : fontSize * 1.18}">${esc(line)}</tspan>`).join('');
    return `<text x="${tx}" y="${baseline}" text-anchor="${anchor}" fill="${color}" fill-opacity="${opacity}" font-family="${fontFamily}" font-size="${fontSize}px" font-weight="${fontWeight}" style="${shadow}" transform="rotate(${rotation} ${tx} ${baseline})">${spans}</text>`;
}
async function renderWelcomeImage(member) {
    const cfg = (0, db_js_1.getGuildConfig)(member.guild.id)?.welcomeDefaults;
    const designer = cfg?.designer;
    if (!designer?.enabled || !Array.isArray(designer.elements))
        return null;
    const width = clamp(designer.canvas?.width ?? 1024, 320, 2048);
    const height = clamp(designer.canvas?.height ?? 341, 180, 1200);
    const bg = designer.background || {};
    const defs = [];
    const body = [];
    let hasBackgroundImage = false;
    if (bg.assetId) {
        const asset = (0, db_js_1.getWelcomeAsset)(bg.assetId, member.guild.id);
        const buffer = asset?.file_path ? await assetBuffer(asset.file_path).catch(() => null) : null;
        if (buffer) {
            body.push(`<image href="${dataImage(buffer, asset.mime || 'image/png')}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="${bg.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}" opacity="${clamp(bg.opacity ?? 1, 0, 1)}"/>`);
            hasBackgroundImage = true;
        }
    }
    else if (bg.assetPath) {
        const buffer = await assetBuffer(bg.assetPath).catch(() => null);
        if (buffer) {
            body.push(`<image href="${dataImage(buffer, assetMime.get(node_path_1.default.extname(bg.assetPath).toLowerCase()) || 'image/png')}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="${bg.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}" opacity="${clamp(bg.opacity ?? 1, 0, 1)}"/>`);
            hasBackgroundImage = true;
        }
    }
    const grad = bg.gradient || {};
    if (!hasBackgroundImage && grad.enabled) {
        defs.push(`<linearGradient id="welcome-bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${hex(grad.from, '#09090D')}"/><stop offset="100%" stop-color="${hex(grad.to, '#17152D')}"/></linearGradient>`);
        body.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="url(#welcome-bg-gradient)"/>`);
    }
    else if (!hasBackgroundImage) {
        body.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${hex(bg.color, '#08080B')}"/>`);
    }
    if (bg.stars?.enabled && !hasBackgroundImage) {
        let seed = Number(bg.stars.seed) || 714;
        const count = clamp(bg.stars.count ?? 58, 0, 180);
        const starColor = hex(bg.stars.color, '#FFFFFF');
        const starOpacity = clamp(bg.stars.opacity ?? 0.42, 0, 1);
        for (let i = 0; i < count; i++) {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            const x = (seed / 4294967296) * width;
            seed = (seed * 1664525 + 1013904223) >>> 0;
            const y = (seed / 4294967296) * height;
            seed = (seed * 1664525 + 1013904223) >>> 0;
            const r = 0.5 + (seed / 4294967296) * 1.5;
            body.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${starColor}" fill-opacity="${starOpacity.toFixed(2)}"/>`);
        }
    }
    if (designer.overlay?.enabled)
        body.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${hex(designer.overlay.color, '#000000')}" fill-opacity="${clamp(designer.overlay.opacity ?? 0.15, 0, 1)}"/>`);
    const elements = [...designer.elements].sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));
    for (const element of elements)
        body.push(await renderElement(element, placeholderValues(member), member, defs));
    const border = designer.border || {};
    if ((Number(border.width) || 0) > 0) {
        const bw = clamp(border.width, 1, 40);
        body.push(`<rect x="${bw / 2}" y="${bw / 2}" width="${width - bw}" height="${height - bw}" rx="${clamp(border.radius ?? 0, 0, 60)}" fill="none" stroke="${hex(border.color, '#7C6CF5')}" stroke-width="${bw}"/>`);
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
    return (0, sharp_1.default)(Buffer.from(svg)).png().toBuffer();
}
function welcomeText(member, value) { return (0, core_js_1.replacePlaceholders)(value, placeholderValues(member)); }
async function sendWelcome(member) {
    const cfg = (0, db_js_1.getGuildConfig)(member.guild.id);
    if (!cfg.modules?.welcome || !cfg.welcomeDefaults?.welcomeEnabled || !cfg.welcomeDefaults?.welcomeChannelId)
        return false;
    const channel = member.guild.channels.cache.get(cfg.welcomeDefaults.welcomeChannelId);
    if (!channel?.isTextBased())
        return false;
    const w = cfg.welcomeDefaults;
    const mode = String(w.mode || 'message').toLowerCase();
    const payload = {};
    const message = welcomeText(member, w.welcomeMessage || 'Welcome {user} to {server}.');
    if (mode === 'message' || mode === 'image_message')
        payload.content = message;
    if (w.messageUseEmbed && payload.content) {
        payload.embeds = [{ title: welcomeText(member, w.welcomeTitle || 'Welcome'), description: message, color: (0, core_js_1.safeHexColor)(w.welcomeColor || '#7C6CF5'), timestamp: false }];
        delete payload.content;
    }
    if (mode === 'image' || mode === 'image_message') {
        const image = await renderWelcomeImage(member).catch(() => null);
        if (image)
            payload.files = [new discord_js_1.AttachmentBuilder(image, { name: `auralis-welcome-${member.id}.png` })];
        else if (mode === 'image')
            payload.content = message;
    }
    if (!payload.content && !payload.embeds?.length && !payload.files?.length)
        return false;
    await channel.send(payload).catch(() => null);
    return true;
}

});
const __cache = new Map();
function __load(id) {
  if (__cache.has(id)) return __cache.get(id).exports;
  const factory = __factories.get(id);
  if (!factory) throw new Error('Bundled module not found: ' + id);
  const module = { exports: {} };
  __cache.set(id, module);
  const localRequire = request => {
    if (typeof request === 'string' && request.startsWith('.')) {
      let target = path.posix.normalize(path.posix.join(path.posix.dirname(id), request));
      if (!path.posix.extname(target)) target += '.js';
      if (__factories.has(target)) return __load(target);
    }
    return require(request);
  };
  factory(module.exports, localRequire, module, path.join(__dirname, id), path.dirname(path.join(__dirname, id)));
  return module.exports;
}
__load('src/dashboard-server.js');
__load('src/index.js');
