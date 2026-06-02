import React from 'react'

function Header() {
  return (
    <header style={styles.header}>
      <h1 style={styles.title}>SurveyInsights</h1>
    </header>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#2196F3',
    color: '#fff',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 600,
  },
}

export default Header