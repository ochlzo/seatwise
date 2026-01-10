import React, { useEffect, useRef, useMemo, ReactNode, RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './ScrollReveal.css';

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealProps {
    children: ReactNode;
    scrollContainerRef?: RefObject<HTMLElement>;
    enableBlur?: boolean;
    baseOpacity?: number;
    baseRotation?: number;
    blurStrength?: number;
    containerClassName?: string;
    textClassName?: string;
    rotationEnd?: string;
    wordAnimationEnd?: string;
}

const wrapWords = (node: ReactNode): ReactNode => {
    if (typeof node === 'string') {
        return node.split(/(\s+)/).map((word, index) => {
            if (word.match(/^\s+$/)) return word;
            return (
                <span className="word" key={index}>
                    {word}
                </span>
            );
        });
    }

    if (Array.isArray(node)) {
        return node.map((child, index) => <React.Fragment key={index}>{wrapWords(child)}</React.Fragment>);
    }

    if (React.isValidElement(node)) {
        if ((node.props as any)?.className?.includes('word')) {
            return node;
        }

        return React.cloneElement(node, {
            ...(node.props as any),
            children: wrapWords((node.props as any).children)
        });
    }

    return node;
};

const ScrollReveal: React.FC<ScrollRevealProps> = ({
    children,
    scrollContainerRef,
    enableBlur = true,
    baseOpacity = 0.1,
    baseRotation = 3,
    blurStrength = 4,
    containerClassName = '',
    textClassName = '',
    rotationEnd = 'bottom bottom',
    wordAnimationEnd = 'bottom bottom'
}) => {
    const containerRef = useRef<HTMLHeadingElement>(null);

    const splitText = useMemo(() => wrapWords(children), [children]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const scroller = scrollContainerRef && scrollContainerRef.current ? scrollContainerRef.current : window;

        gsap.fromTo(
            el,
            { transformOrigin: '0% 50%', rotate: baseRotation },
            {
                ease: 'none',
                rotate: 0,
                scrollTrigger: {
                    trigger: el,
                    scroller,
                    start: 'top bottom',
                    end: rotationEnd,
                    scrub: true
                }
            }
        );

        const wordElements = el.querySelectorAll<HTMLElement>('.word');
        if (wordElements.length === 0) return;

        gsap.fromTo(
            wordElements,
            { opacity: baseOpacity, willChange: 'opacity' },
            {
                ease: 'none',
                opacity: 1,
                stagger: 0.05,
                scrollTrigger: {
                    trigger: el,
                    scroller,
                    start: 'top bottom-=20%',
                    end: wordAnimationEnd,
                    scrub: true
                }
            }
        );

        if (enableBlur) {
            gsap.fromTo(
                wordElements,
                { filter: `blur(${blurStrength}px)` },
                {
                    ease: 'none',
                    filter: 'blur(0px)',
                    stagger: 0.05,
                    scrollTrigger: {
                        trigger: el,
                        scroller,
                        start: 'top bottom-=20%',
                        end: wordAnimationEnd,
                        scrub: true
                    }
                }
            );
        }

        return () => {
            ScrollTrigger.getAll().forEach(trigger => trigger.kill());
        };
    }, [scrollContainerRef, enableBlur, baseRotation, baseOpacity, rotationEnd, wordAnimationEnd, blurStrength, children]);

    return (
        <h2 ref={containerRef} className={`scroll-reveal ${containerClassName}`}>
            <div className={`scroll-reveal-text ${textClassName}`}>{splitText}</div>
        </h2>
    );
};

export default ScrollReveal;
