import './helios-card';
import type { HassLike } from './core/ha-types';

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
    'chip-home-visible': false,
    'chip-production-visible': false,
    'chip-grid-visible': false,
    'chip-battery-visible': false,
    'weather-enabled': false,
    'auto-rotate-enabled': false,
});
card.hass = hass;