/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		// NOTE: deliberately NOT overriding fontFamily.sans / .serif here.
  		// Doing so repoints Tailwind's preflight `html { font-family: ... }` and
  		// changes the typeface for the ENTIRE app, not just the Journey. The
  		// Journey's fonts are set inside the `.mf` scope in
  		// src/styles/journeyTheme.css, which cannot leak.
  		colors: {
  			// Mental Fitness Journey. Values mirror the CSS custom properties in
  			// src/styles/journeyTheme.css — change them THERE and here together.
  			// The four driver hues are a validated categorical palette; see that
  			// file's header before substituting any of them.
  			mf: {
  				plum: '#441D37',
  				'plum-dark': '#35162B',
  				cream: '#F0EDE6',
  				coral: '#E8866A',
  				forest: '#2D4A3E',
  				ink: '#241019',
  				'ink-2': '#5A4A52',
  				'ink-3': '#8A7B82',
  				rule: 'rgba(68,29,55,0.12)',
  				grid: '#E4DFD7',
  				warn: '#B4531F',
  				presenteeism: '#8E3F72',
  				absenteeism: '#EB6834',
  				turnover: '#1BAF7A',
  				medical: '#2A78D6',
  				'ord-0': '#B9B2AC',
  				'ord-1': '#C39CB4',
  				'ord-2': '#8E5379',
  				'ord-3': '#52223F',
  			},
  			brand: {
  				navy: '#013f7c',
  				green: '#264d44',
  				plum: '#770142',
  				cream: '#f4f0e9',
  				forest: '#223d32',
  				peach: '#ff9878',
  					'navy-dark': '#012d5a',
  					'plum-dark': '#5a0132',
  					lime: '#eaf995',
  					bark: '#422E33',
  					'journey-blue': '#C5D4F2',
  					'journey-rose': '#F2D4D4',
  					'journey-amber': '#F2C2A6',
  					'journey-sage': '#E6F2B8',
  				},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}