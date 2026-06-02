import React from 'react'

interface CardProps {
  image: string
  title?: string
  onBuy?: () => void
  isPurchased?: boolean
  isLoading?: boolean
}

function Card({ image, title, onBuy, isPurchased = false, isLoading = false }: CardProps) {
  const buttonDisabled = isPurchased || isLoading;

  return (
    <div style={styles.card}>
      <img src={image} alt={title || 'Product'} style={styles.image} />
      {title && <h3 style={styles.title}>{title}</h3>}
      <button
        style={{
          ...styles.button,
          ...(buttonDisabled ? styles.buttonDisabled : {}),
        }}
        onClick={onBuy}
        disabled={buttonDisabled}
      >
        {isLoading ? 'Loading...' : isPurchased ? 'Purchased' : 'Buy'}
      </button>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    backgroundColor: '#fff',
    maxWidth: '300px',
  },
  image: {
    width: '100%',
    height: 'auto',
    borderRadius: '4px',
    objectFit: 'cover',
  },
  title: {
    margin: '12px 0',
    fontSize: '18px',
    fontWeight: 600,
  },
  button: {
    padding: '10px 24px',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 500,
  },
  buttonDisabled: {
    backgroundColor: '#9e9e9e',
    cursor: 'not-allowed',
  },
}

export default Card