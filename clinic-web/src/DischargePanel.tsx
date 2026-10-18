import { useState } from 'react'
import VaccineHistory from './VaccineHistory'
import VaccineLog from './VaccineLog'
import type { Pet } from './types'

export default function DischargePanel({ pet, onLogged }: { pet: Pet; onLogged: () => Promise<void> | void }) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      <VaccineLog
        pet={pet}
        onLogged={async () => {
          setRefreshKey((k) => k + 1)
          await onLogged()
        }}
      />
      <VaccineHistory pet={pet} editable refreshKey={refreshKey} />
    </>
  )
}