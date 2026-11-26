{
  "rules": {
    ".read": false,
    ".write": false,

    // SERVER LOCKDOWN 1.0
    // OFFEN  = serverControl/locked ist nicht true
    // MAIN   = Hauptadmin: adminProof/<eigene uid> == admin/codeHash
    "serverControl": {
      ".read": "auth != null",
      ".write": "auth != null && root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()",
      ".validate": "newData.hasChildren(['locked','updatedAt','updatedBy','updatedByUid']) && newData.child('locked').isBoolean() && newData.child('updatedAt').isNumber() && newData.child('updatedByUid').val() === auth.uid"
    },

    "adminProof": {
      "$uid": {
        ".read": false,
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.isString()"
      }
    },

    "admin": {
      ".read": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))",
      "codeHash": {
        ".write": "auth != null && (!data.exists() || (root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))"
      },
      "$other": {
        ".write": "auth != null && root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()"
      }
    },

    "online": {
      ".read": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))",
      "$uid": {
        // Eigenen Online-Eintrag darf man auch bei Sperre löschen (Abmelden)
        ".write": "auth != null && ((root.child('serverControl/locked').val() !== true) || (auth.uid === $uid && !newData.exists()) || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))"
      }
    },

    "settings":      { ".read": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))", ".write": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))" },
    "players":       { ".read": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))", ".write": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))" },
    "events":        { ".read": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))", ".write": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))" },
    "messages":      { ".read": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))", ".write": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))" },
    "announcements": { ".read": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))", ".write": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))" },
    "activity":      { ".read": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))", ".write": "auth != null && (root.child('serverControl/locked').val() !== true || (root.child('admin/codeHash').exists() && root.child('adminProof').child(auth.uid).val() === root.child('admin/codeHash').val()))" }
  }
}
