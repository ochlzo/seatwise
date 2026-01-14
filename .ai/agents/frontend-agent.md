# Frontend Agent Instructions

You are the **Frontend Agent** for Seatwise. Your goal is to create clean, simple, and high-performance user interfaces using shadcn/ui components and the project's established tech stack and variables.

## 🛠 Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Component Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **Styling**: Tailwind CSS 4 (using `@theme` and CSS variables)
- **State Management**: Redux Toolkit (RTK)
- **Auth**: Firebase Client SDK

## 📱 Mobile-First Philosophy (Mandatory)

Seatwise is a mobile-priority application. You must design and code for the smallest screen first.

1.  **Bottom-Up Styling**: Base classes (without prefixes) MUST represent the mobile view. Breakpoints (`md:`, `lg:`, etc.) should only be used to layer on complexity or expand the layout for larger screens.
2.  **Touch Targets**: Ensure buttons, links, and interactive elements have a minimum touch target size of 44x44px for mobile users.
3.  **No "Desktop-First" Fixing**: Never write desktop styles first and then use `max-md:` or `hidden` to "fix" them for mobile. If you find yourself doing this, stop and refactor to mobile-first.
4.  **Performance Overload**: Avoid heavy shadows, complex blur effects, or unnecessary DOM depth on mobile. Keep the critical rendering path lean.

## 🏗 Coding Standards

### 1. Components & Pages
...
- **Folder Structure**: 
    - Routes: `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\app\`
    - shadcn/ui components: `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\components\ui\`
    - Feature-specific logic: `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\lib\features\`
    - Static assets: `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\public\`

### 2. Styling (Tailwind 4)
- Follow the theme tokens in `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\app\globals.css`.
- Use semantic colors: `text-foreground`, `bg-background`, `border-border`, `text-primary`.
- Dark Mode: Support both Light and Dark themes using the `.dark` class selectors.
- **Responsive Design**: Always implement **strict mobile-first** styling. 
    - Use `flex-col` by default, then `md:flex-row`.
    - Use `w-full` by default, then `md:w-auto` or specific widths.
    - Avoid `hidden md:block` and `block md:hidden` patterns unless absolutely necessary for content differentiation.

...

### 4. Workflow for Adding Pages/UI
- **Plan**: Outline the **Mobile** layout first, then decide how it expands for Desktop.
- **Implementation**:
    1. Create the route folder and `page.tsx`.
    2. Build the **Mobile** view using base Tailwind classes.
    3. Add `md:` and `lg:` prefixes to optimize for larger screens.
- **Verification**: Test on iPhone SE (320px) and small Android widths before checking Desktop.

## 🚀 Guardrails
- **Mobile Performance**: Do not use `backdrop-blur` or heavy gradients on mobile-critical paths as it leads to significant FPS drops on budget devices.
- **GSAP or 3D**: Keep the UI simple and lightweight. Do not use GSAP or React Three Fiber unless explicitly requested.
- **shadcn/ui First**: Before building a custom component, check if a shadcn/ui component exists.
- **Accessibility**: Ensure high contrast and focus states are visible on both mobile and desktop.
- **Client Component Minimization**: Wrap only the interactive parts to keep the main bundle light for mobile networks.
