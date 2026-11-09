/**
 * =============================================================================
 * BUTTON COMPONENT
 * =============================================================================
 * 
 * Переиспользуемый компонент кнопки с поддержкой тем (light/dark).
 * 
 * ВАЖНО ДЛЯ ДРУГИХ АГЕНТОВ:
 * Если вам нужна кнопка — используйте этот компонент!
 * НЕ создавайте свои кнопки со стилями. Просто импортируйте:
 * 
 *   import { Button } from '@/components/ui/Button';
 *   <Button variant="secondary">Click me</Button>
 * 
 * =============================================================================
 * 
 * 🎨 ВАРИАНТЫ (variant prop):
 * 
 * 1. "primary"   — Главное действие (инвертированные цвета). Используй для "Save", "Confirm"
 * 2. "secondary" — Второстепенное действие (серый). Используй для "Cancel", "Undo"
 * 3. "ghost"     — Прозрачная кнопка. Используй для иконок, минималистичных действий
 * 4. "danger"    — Опасное действие (красный). Используй для "Delete", "Remove"
 * 5. "outline"   — Акцентная с обводкой (синяя). Используй для "Save as v.X", альтернативных CTA
 * 6. "accent"    — Синяя кнопка (бренд цвет). Используй для ссылок-действий, "Learn more"
 * 
 * 📏 РАЗМЕРЫ (size prop):
 * 
 * 1. "sm" — Маленькая (h-8, text-sm). Для тулбаров, компактных UI
 * 2. "md" — Средняя (h-10, text-sm). Стандартный размер
 * 3. "lg" — Большая (h-12, text-base). Для модалок, hero-секций
 * 
 * =============================================================================
 * 
 * 🔧 КАК ПОДКРУЧИВАТЬ СТИЛИ:
 * 
 * Цвета кнопок берутся из CSS Variables в /src/index.css:
 * 
 * Для SECONDARY кнопки:
 *   Light: --button-secondary-bg, --button-secondary-hover, --button-secondary-text
 *   Dark:  те же переменные, но значения из .dark {}
 * 
 * Для PRIMARY кнопки:
 *   --primary-button-bg, --primary-button-hover, --primary-button-text
 * 
 * Чтобы изменить цвет — меняй значения в index.css, НЕ здесь!
 * 
 * =============================================================================
 */

import React from 'react';

// -----------------------------------------------------------------------------
// ТИПЫ
// -----------------------------------------------------------------------------

/**
 * Варианты стилей кнопки.
 * Каждый вариант имеет свой набор цветов для фона, текста и hover-состояния.
 */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'accent';

/**
 * Размеры кнопки.
 * Влияют на высоту, padding и размер шрифта.
 */
type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Пропсы компонента Button.
 * Расширяет стандартные атрибуты HTML-кнопки.
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * Визуальный стиль кнопки.
     * @default "secondary"
     */
    variant?: ButtonVariant;

    /**
     * Размер кнопки.
     * @default "md"
     */
    size?: ButtonSize;

    /**
     * Состояние загрузки. Когда true — кнопка disabled и показывает индикатор.
     * @default false
     */
    isLoading?: boolean;

    /**
     * Иконка слева от текста.
     * Передай React-элемент, например: <Plus size={16} />
     */
    leftIcon?: React.ReactNode;

    /**
     * Иконка справа от текста.
     * Передай React-элемент, например: <ChevronRight size={16} />
     */
    rightIcon?: React.ReactNode;

    /**
     * Дополнительные CSS-классы.
     * Используй для кастомизации в редких случаях.
     */
    className?: string;

    /**
     * Содержимое кнопки (текст, иконки и т.д.)
     */
    children?: React.ReactNode;
}

// -----------------------------------------------------------------------------
// СТИЛИ
// -----------------------------------------------------------------------------

/**
 * Базовые классы, общие для ВСЕХ вариантов кнопки.
 * 
 * 🔧 Чтобы изменить форму кнопки:
 *    - rounded-full → круглые края (pill-shaped)
 *    - rounded-lg   → слегка скруглённые углы
 *    - rounded-none → прямоугольная
 */
const baseStyles = `
    inline-flex items-center justify-center gap-2
    font-medium
    rounded-full
    transition-colors duration-150
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
`;

/**
 * Стили для каждого варианта кнопки.
 * 
 * ВАЖНО: Классы используют CSS Variables из index.css,
 * поэтому автоматически работают в light и dark темах!
 * 
 * 🔧 Чтобы изменить цвета — редактируй index.css, не эти классы.
 */
const variantStyles: Record<ButtonVariant, string> = {
    /**
     * PRIMARY — Главное действие (инвертированные цвета)
     * 
     * Используется для основных CTA: "Save", "Confirm", "Submit"
     * 
     * Логика цветов (автоматически инвертируются по теме):
     *   Light Mode: Чёрный фон (#0f0f0f) + Белый текст (#ffffff)
     *   Dark Mode:  Белый фон (#ffffff) + Чёрный текст (#0f0f0f)
     * 
     * Это самый заметный вариант — привлекает внимание пользователя.
     */
    primary: `
        bg-text-primary
        text-bg-primary
        hover:opacity-90
        focus-visible:ring-text-primary
    `,

    /**
     * SECONDARY — Второстепенное действие
     * 
     * Цвета из CSS Variables:
     *   Light: --button-secondary-bg: #F2F2F2, hover: #E5E5E5, text: #030303
     *   Dark:  --button-secondary-bg: #3E3E3E, hover: #535353, text: #FFFFFF
     * 
     * 🔧 Это самый часто используемый вариант. Меняй цвета в index.css:
     *    - Секция "Component: Video Details & Packaging" для light theme
     *    - Та же секция в .dark {} для dark theme
     */
    secondary: `
        bg-button-secondary-bg
        text-button-secondary-text
        hover:bg-button-secondary-hover
        focus-visible:ring-button-secondary-bg
    `,

    /**
     * GHOST — Прозрачная кнопка
     * 
     * Без фона, только текст и hover-эффект.
     * Хорошо подходит для иконок-кнопок.
     */
    ghost: `
        bg-transparent
        text-text-secondary
        hover:bg-hover-bg
        hover:text-text-primary
        focus-visible:ring-text-secondary
    `,

    /**
     * DANGER — Деструктивное действие
     * 
     * Красный цвет для привлечения внимания к опасности.
     * Используй для "Delete", "Remove permanently".
     */
    danger: `
        bg-[var(--danger-color)]
        text-white
        hover:opacity-90
        focus-visible:ring-[var(--danger-color)]
    `,

    /**
     * OUTLINE — Акцентная кнопка с обводкой
     * 
     * Прозрачный фон с цветной обводкой. Используется для:
     *   - "Save as v.X" — важное, но не главное действие
     *   - Альтернативные CTA
     *   - Кнопки, которые должны выделяться, но не доминировать
     * 
     * Цвет обводки: #3ea6ff (YouTube Studio accent blue)
     * 
     * 🔧 Чтобы изменить цвет:
     *    Используется токен brand-blue (--color-brand-blue в index.css).
     * 
     * Стили:
     *   - Прозрачный фон
     *   - Синяя обводка 1px
     *   - Синий текст
     *   - При hover: лёгкая синяя заливка (10% opacity)
     */
    outline: `
        bg-transparent
        border border-brand-blue
        text-brand-blue
        hover:bg-brand-blue/10
        focus-visible:ring-brand-blue
    `,

    /**
     * FILLED — Инвертированная кнопка (высокий контраст)
     * 
     * Главное действие с инвертированными цветами темы.
     * Используется для "Save as draft" и других важных действий.
     * 
     * Логика цветов (автоматически инвертируются по теме):
     *   Light Mode: Чёрный фон (#0f0f0f) + Белый текст (#ffffff)
     *   Dark Mode:  Белый фон (#ffffff) + Чёрный текст (#0f0f0f)
     * 
     * 🔧 Отличие от PRIMARY:
     *    - PRIMARY — всегда синий (бренд цвет)
     *    - FILLED  — инвертированные цвета темы (чёрный ↔ белый)
     * 
     * Используй для:
     *   - Ссылки-действия
     *   - "Learn more", "View details"
     *   - Второстепенные CTA с акцентом
     */
    accent: `
        bg-[var(--primary-button-bg)]
        text-[var(--primary-button-text)]
        hover:bg-[var(--primary-button-hover)]
        focus-visible:ring-[var(--primary-button-bg)]
    `,
};

/**
 * Стили для каждого размера кнопки.
 * 
 * 🔧 Чтобы изменить размеры:
 *    - h-X    → высота кнопки
 *    - px-X   → горизонтальный padding
 *    - text-X → размер шрифта
 */
const sizeStyles: Record<ButtonSize, string> = {
    /** Маленькая: для тулбаров, dropdown-ов */
    sm: 'h-8 px-3 text-sm',

    /** Средняя: стандартный размер для большинства случаев */
    md: 'h-10 px-4 text-sm',

    /** Большая: для модалок, важных CTA */
    lg: 'h-12 px-6 text-base',
};

// -----------------------------------------------------------------------------
// КОМПОНЕНТ
// -----------------------------------------------------------------------------

/**
 * Универсальная кнопка с поддержкой тем.
 * 
 * @example
 * // Простой secondary (по умолчанию)
 * <Button>Cancel</Button>
 * 
 * @example
 * // Primary action
 * <Button variant="primary">Save Changes</Button>
 * 
 * @example
 * // С иконкой
 * <Button variant="secondary" leftIcon={<Plus size={16} />}>
 *     Add Item
 * </Button>
 * 
 * @example
 * // Loading state
 * <Button variant="primary" isLoading>
 *     Saving...
 * </Button>
 * 
 * @example
 * // Danger action
 * <Button variant="danger" size="sm">
 *     Delete
 * </Button>
 */
export const Button: React.FC<ButtonProps> = ({
    variant = 'secondary',  // По умолчанию — secondary (самый безопасный)
    size = 'md',            // По умолчанию — средний размер
    isLoading = false,
    leftIcon,
    rightIcon,
    className = '',
    disabled,
    children,
    ...rest                 // Все остальные HTML-атрибуты (onClick, type, etc.)
}) => {
    // Собираем все классы вместе
    const classes = [
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className,
    ].join(' ').replace(/\s+/g, ' ').trim();

    return (
        <button
            className={classes}
            disabled={disabled || isLoading}
            {...rest}
        >
            {/* Левая иконка (если есть) */}
            {leftIcon && !isLoading && (
                <span className="flex-shrink-0">{leftIcon}</span>
            )}

            {/* Индикатор загрузки */}
            {isLoading && (
                <span className="flex-shrink-0 animate-spin">
                    {/* 
                        Простой спиннер через CSS.
                        Можешь заменить на свою иконку загрузки.
                    */}
                    <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                </span>
            )}

            {/* Текст/содержимое кнопки */}
            {children && <span>{children}</span>}

            {/* Правая иконка (если есть) */}
            {rightIcon && !isLoading && (
                <span className="flex-shrink-0">{rightIcon}</span>
            )}
        </button>
    );
};

// Экспорт типов для использования в других компонентах
export type { ButtonProps, ButtonVariant, ButtonSize };
