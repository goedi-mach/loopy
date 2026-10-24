import { useState } from 'react'
import MicrochipLog from './MicrochipLog'
import VaccineHistory from './VaccineHistory'
import VaccineLog from './VaccineLog'
import type { Client, Pet } from './types'

interface Props {
  pet: Pet
  client: Client
  onLogged: () => Promise<void> | void
  onPetChanged: () => Promise<void> | void
}

export default function DischargePanel({ pet, client, onLogged, onPetChanged }: Props) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      <MicrochipLog pet={pet} onChanged={onPetChanged} />
      <VaccineLog
        pet={pet}
        client={client}
        onLogged={async () => {
          setRefreshKey((k) => k + 1)
          await onLogged()
        }}
      />
      <VaccineHistory pet={pet} client={client} editable refreshKey={refreshKey} />
    </>
  )
}