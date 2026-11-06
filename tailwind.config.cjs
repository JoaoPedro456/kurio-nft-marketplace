module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        ink: '#140D0A',
        foreground: '#F5F1EB',
        surfaceCard: '#241612',
        surfaceRaised: '#2F1D15',
        surfaceDark: '#38220F',
        border: '#3F2319',
        borderSoft: '#55321F',
        primary: '#D28A4C',
        textAccent: '#E89B55',
        textPrimary: '#F7F3EC',
        textSecondary: '#CFB28C',
        secondary: '#B39463',
        textCoral: '#F0805F',
      },
      fontFamily: {
        mono: ['Roboto Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};