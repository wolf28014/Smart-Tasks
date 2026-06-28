' TodoList Silent Launcher
' Launches Next.js dev server in background without any window.
' Used by Windows Task Scheduler for auto-start on login.

Option Explicit

Dim WshShell, fso
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

Dim scriptDir, projectRoot, logFile
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(scriptDir)
logFile = projectRoot & "\dev.log"

WshShell.CurrentDirectory = projectRoot

Dim cmd
If fso.FileExists(projectRoot & "\node_modules\.bin\next") Then
    cmd = "cmd /c node_modules\.bin\next dev -p 3000 > """ & logFile & """ 2>&1"
Else
    cmd = "cmd /c npx next dev -p 3000 > """ & logFile & """ 2>&1"
End If

WshShell.Run cmd, 0, False

Dim logStream
Set logStream = fso.OpenTextFile(logFile, 8, True)
logStream.WriteLine ""
logStream.WriteLine "============================================"
logStream.WriteLine Now & " - TodoList dev server started (background)"
logStream.WriteLine "Project: " & projectRoot
logStream.WriteLine "Log: " & logFile
logStream.WriteLine "URL: http://localhost:3000"
logStream.WriteLine "============================================"
logStream.Close
