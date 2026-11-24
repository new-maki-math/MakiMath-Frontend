import { defineComponent, h } from 'vue';

const paths = {
  HalfMoon: 'M19.9 15.2A8.6 8.6 0 0 1 8.8 4.1a9 9 0 1 0 11.1 11.1',
  SunLight:
    'M11 2h2v3h-2zm0 17h2v3h-2zM2 11h3v2H2zm17 0h3v2h-3zM4.22 5.64l1.42-1.42 2.12 2.12-1.42 1.42zm12.02 12.02 1.42-1.42 2.12 2.12-1.42 1.42zM16.24 6.34l2.12-2.12 1.42 1.42-2.12 2.12zM4.22 18.36l2.12-2.12 1.42 1.42-2.12 2.12zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12',
  SeasonSpring:
    'M8.83 7.63 Q12 -1.2 15.17 7.63 Q24.55 7.92 17.14 13.67 Q19.76 22.68 12 17.4 Q4.24 22.68 6.86 13.67 Q-0.55 7.92 8.83 7.63 Z M12 10.15a1.85 1.85 0 1 0 0 3.7 1.85 1.85 0 0 0 0-3.7',
  SeasonAutumn:
    'M4890 4430l-45-863a95 95 0 0 1 111-98l859 151-116-320a65 65 0 0 1 20-73l941-762-212-99a65 65 0 0 1-34-79l186-572-542 115a65 65 0 0 1-73-38l-105-247-423 454a65 65 0 0 1-111-57l204-1052-327 189a65 65 0 0 1-91-27l-332-652-332 652a65 65 0 0 1-91 27l-327-189 204 1052a65 65 0 0 1-111 57l-423-454-105 247a65 65 0 0 1-73 38l-542-115 186 572a65 65 0 0 1-34 79l-212 99 941 762a65 65 0 0 1 20 73l-116 320 859-151a95 95 0 0 1 111 98l-45 863z',
  SeasonWinter:
    'M12.82 9.6 L12.82 6.4 L14.95 4.27 L13.95 3.27 L12.82 4.4 L12.82 2 L11.18 2 L11.18 4.4 L10.05 3.27 L9.05 4.27 L11.18 6.4 L11.18 9.6 L10.33 10.09 L7.56 8.49 L6.78 5.58 L5.41 5.95 L5.83 7.49 L3.75 6.29 L2.93 7.71 L5.01 8.91 L3.46 9.32 L3.83 10.69 L6.74 9.91 L9.51 11.51 L9.51 12.49 L6.74 14.09 L3.83 13.31 L3.46 14.68 L5.01 15.09 L2.93 16.29 L3.75 17.71 L5.83 16.51 L5.41 18.05 L6.78 18.42 L7.56 15.51 L10.33 13.91 L11.18 14.4 L11.18 17.6 L9.05 19.73 L10.05 20.73 L11.18 19.6 L11.18 22 L12.82 22 L12.82 19.6 L13.95 20.73 L14.95 19.73 L12.82 17.6 L12.82 14.4 L13.67 13.91 L16.44 15.51 L17.22 18.42 L18.59 18.05 L18.17 16.51 L20.25 17.71 L21.07 16.29 L18.99 15.09 L20.54 14.68 L20.17 13.31 L17.26 14.09 L14.49 12.49 L14.49 11.51 L17.26 9.91 L20.17 10.69 L20.54 9.32 L18.99 8.91 L21.07 7.71 L20.25 6.29 L18.17 7.49 L18.59 5.95 L17.22 5.58 L16.44 8.49 L13.67 10.09 Z'
};

function createThemeIcon(name) {
  const scale = name === 'SeasonSpring' ? 1.14 : 1;
  return defineComponent({
    name: `MIcon${name}`,
    setup(_, { attrs }) {
      return () =>
        h(
          'svg',
          {
            width: '1em',
            height: '1em',
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            'aria-hidden': 'true',
            focusable: 'false',
            ...attrs
          },
          [
            h('path', {
              d: paths[name],
              transform:
                name === 'SeasonAutumn'
                  ? 'translate(12 12) scale(0.0049) translate(-4800 -2400)'
                  : scale === 1
                    ? undefined
                    : `translate(12 12) scale(${scale}) translate(-12 -12)`,
              'fill-rule': 'evenodd',
              'clip-rule': 'evenodd'
            })
          ]
        );
    }
  });
}

export const HalfMoon = createThemeIcon('HalfMoon');
export const SunLight = createThemeIcon('SunLight');
export const SeasonSpring = createThemeIcon('SeasonSpring');
export const SeasonAutumn = createThemeIcon('SeasonAutumn');
export const SeasonWinter = createThemeIcon('SeasonWinter');
