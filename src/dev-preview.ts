import './helios-card';
import type { HassLike } from './core/ha-types';

const PREVIEW_WINDOWS = [
    { id: 'bedroom-room-1', label: 'BR1', building: 'home', azimuth: 120, 'along-facade': -2.4 },
    { id: 'bedroom-room-2', label: 'BR2', building: 'home', azimuth: 104, 'along-facade': -1.2 },
    { id: 'living-room-1', label: 'LR1', building: 'home', azimuth: 104 },
    { id: 'living-room-2', label: 'LR2', building: 'home', azimuth: 104, 'along-facade': 1.2 },
    { id: 'office-room1', label: 'OR1', building: 'home', azimuth: 245 },
    { id: 'office-room2', label: 'OR2', building: 'home', azimuth: 245, 'along-facade': -1.2 },
    { id: 'piano-room1', label: 'PR1', building: 'home', azimuth: 245, 'along-facade': -2.4 },
    { id: 'piano-room2', label: 'PR2', building: 'home', azimuth: 245, 'along-facade': -3.6 },
];

const PREVIEW_ICON_GLYPHS: Record<string, string> = {
    'mdi:blinds': '▤',
    'mdi:blinds-open': '▥',
    'mdi:blinds-horizontal': '▧',
    'mdi:weather-sunny-off': '☼̸',
    'mdi:white-balance-sunny': '☀',
    'mdi:weather-partly-cloudy': '◐',
    'mdi:weather-cloudy': '☁',
    'mdi:thermometer': '°',
    'mdi:water-percent': '◒',
    'mdi:clock-outline': '◷',
    'mdi:circle-medium': '•',
    'mdi:skip-forward': '≫',
    'mdi:weather-pouring': '☔',
    'mdi:weather-sunset-up': '☀↑',
    'mdi:weather-sunset-down': '☀↓',
};

if (!customElements.get('ha-icon'))
{
    class PreviewHaIcon extends HTMLElement
    {
        public static get observedAttributes(): string[]
        {
            return ['icon'];
        }

        public connectedCallback(): void
        {
            this._renderGlyph();
        }

        public attributeChangedCallback(): void
        {
            this._renderGlyph();
        }

        private _renderGlyph(): void
        {
            this.textContent = PREVIEW_ICON_GLYPHS[this.getAttribute('icon') ?? ''] ?? '';
            this.setAttribute('aria-hidden', 'true');
            this.style.display = 'inline-flex';
            this.style.alignItems = 'center';
            this.style.justifyContent = 'center';
            this.style.flex = '0 0 auto';
            this.style.width = 'var(--mdc-icon-size, 16px)';
            this.style.height = 'var(--mdc-icon-size, 16px)';
            this.style.fontSize = 'var(--mdc-icon-size, 16px)';
            this.style.lineHeight = '1';
        }
    }

    customElements.define('ha-icon', PreviewHaIcon);
}

const hass: HassLike = {
    states: {},
    config: {
        latitude: 46.975833,
        longitude: 28.870175,
        elevation: 56,
        time_zone: 'Europe/Chisinau',
        currency: 'USD',
        unit_system: { temperature: '°C' },
    },
    connection: {
        subscribeEvents: async () => () => undefined,
    },
    callWS: async <T>(payload: object): Promise<T> => {
        const type = (payload as { type?: string }).type;
        if (type === 'energy/get_prefs') {
            return { energy_sources: [], device_consumption: [] } as T;
        }
        if (type === 'energy/info') {
            return { cost_sensors: {} } as T;
        }
        return {} as T;
    },
    language: 'en',
    locale: { time_format: '24' },
    themes: { darkMode: false },
    user: { is_admin: false },
};

const card = document.querySelector('helios-card') as (HTMLElement & {
    hass: HassLike;
    preview: boolean;
    setConfig: (config: Record<string, unknown>) => void;
}) | null;

if (!card) {
    throw new Error('Helios preview element was not found');
}

card.preview = true;
card.setConfig({
    'home-latitude': hass.config.latitude,
    'home-longitude': hass.config.longitude,
    'window-sill-height': 1.2,
    'curtain-max-depth': 1,
    'window-azimuth-arrow': true,
    windows: PREVIEW_WINDOWS,
    'chip-home-visible': false,
    'chip-production-visible': false,
    'chip-grid-visible': false,
    'chip-battery-visible': false,
    'weather-enabled': false,
    'auto-rotate-enabled': false,
});
card.hass = hass;