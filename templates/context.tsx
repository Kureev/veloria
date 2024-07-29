import React from 'react'
import { SQLiteProvider } from 'expo-sqlite'

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <SQLiteProvider databaseName="$DB_NAME" assetSource={{ assetId: require('$DB_PATH') }}>
      {children}
    </SQLiteProvider>
  )
}
