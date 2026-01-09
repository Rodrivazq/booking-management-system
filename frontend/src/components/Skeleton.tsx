import React from 'react'

interface SkeletonProps {
    className?: string
    style?: React.CSSProperties
    width?: string | number
    height?: string | number
    borderRadius?: string | number
}

export default function Skeleton({ className, style, width, height, borderRadius }: SkeletonProps) {
    const styles: React.CSSProperties = {
        width,
        height,
        borderRadius,
        ...style
    }

    return <div className={`skeleton ${className || ''}`} style={styles} />
}
