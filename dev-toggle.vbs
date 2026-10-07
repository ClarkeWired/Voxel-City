Option Explicit

' Voxel City dev launcher.
'
'   cscript dev-toggle.vbs        start the dev server if it is not already
'                                 running, then open it in the browser.
'                                 Running it again just reopens the browser -
'                                 it never stops or restarts the server.
'   cscript dev-toggle.vbs stop   shut the running server down.
'
' Log and state live in the project-local .local\ folder (git-ignored), never
' in %TEMP%.

Const MIN_PORT = 20000
Const MAX_PORT = 60000
Const MAX_PORT_ATTEMPTS = 30
Const READY_ATTEMPTS = 40
Const READY_SLEEP_MS = 250

Dim shell, fso, wmi
Dim scriptDir, localDir, stateFile, logFile
Dim port, pid, cmd, i, arg

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Set wmi = GetObject("winmgmts:\\.\root\cimv2")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
localDir = scriptDir & "\.local"

If Not fso.FolderExists(localDir) Then fso.CreateFolder(localDir)

stateFile = localDir & "\dev.state"
logFile = localDir & "\vite.log"

shell.CurrentDirectory = scriptDir

arg = ""
If WScript.Arguments.Count > 0 Then arg = LCase(Trim(WScript.Arguments(0)))

' ---------------------------------------------------------------
' stop - explicit opt-in only; never reached from a bare double-click
' ---------------------------------------------------------------

If arg = "stop" Then
    port = RunningPort()

    If port > 0 Then
        pid = ListeningPid(port)

        If pid > 0 Then
            shell.Run "cmd.exe /c taskkill /PID " & pid & " /T /F >nul 2>&1", 0, True
        End If
    End If

    DeleteFileIfExists stateFile
    WScript.Quit 0
End If

' ---------------------------------------------------------------
' start - idempotent; reuse a server that is already up
' ---------------------------------------------------------------

port = RunningPort()

If port <= 0 Then
    port = PickFreePort()

    If port = 0 Then
        MsgBox "Could not find a free port for the dev server.", vbCritical, "Voxel City"
        WScript.Quit 1
    End If

    DeleteFileIfExists logFile

    cmd = "cmd.exe /d /s /c " & Chr(34) & _
          "npm run dev -- --host 127.0.0.1 --port " & port & _
          " --strictPort > " & Chr(34) & logFile & Chr(34) & " 2>&1" & _
          Chr(34)

    shell.Run cmd, 0, False

    If Not WaitForListening(port) Then
        MsgBox "Voxel City failed to start." & vbCrLf & vbCrLf & _
               "Log: " & logFile, vbCritical, "Voxel City"
        WScript.Quit 1
    End If

    WriteState port
End If

shell.Run "http://127.0.0.1:" & port & "/", 1, False
WScript.Quit 0


' Port of this project's server: the saved port if it still answers, otherwise
' a scan for a node/vite process launched from this folder.

Function RunningPort()
    Dim saved

    RunningPort = 0
    saved = ReadState()

    If saved > 0 Then
        If ListeningPid(saved) > 0 Then
            RunningPort = saved
            Exit Function
        End If
    End If

    DeleteFileIfExists stateFile
    RunningPort = FindVitePort()
End Function


Function FindVitePort()
    Dim items, item, cl, re, matches, candidate

    FindVitePort = 0

    Set re = New RegExp
    re.IgnoreCase = True
    re.Global = False
    re.Pattern = "--port\s+(\d+)"

    On Error Resume Next
    Set items = wmi.ExecQuery( _
        "SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name = 'node.exe'")
    On Error GoTo 0

    If items Is Nothing Then Exit Function

    For Each item In items
        If Not IsNull(item.CommandLine) Then
            cl = CStr(item.CommandLine)

            If InStr(1, cl, scriptDir, vbTextCompare) > 0 Then
                If re.Test(cl) Then
                    Set matches = re.Execute(cl)
                    candidate = CLng(matches(0).SubMatches(0))

                    If candidate > 0 Then
                        If ListeningPid(candidate) > 0 Then
                            FindVitePort = candidate
                            Exit Function
                        End If
                    End If
                End If
            End If
        End If
    Next
End Function


Function PickFreePort()
    Dim attempt, candidate

    PickFreePort = 0
    Randomize Timer

    For attempt = 1 To MAX_PORT_ATTEMPTS
        candidate = Int((MAX_PORT - MIN_PORT + 1) * Rnd + MIN_PORT)

        If ListeningPid(candidate) = 0 Then
            PickFreePort = candidate
            Exit Function
        End If
    Next
End Function


Function WaitForListening(ByVal checkPort)
    Dim attempt

    WaitForListening = False

    For attempt = 1 To READY_ATTEMPTS
        WScript.Sleep READY_SLEEP_MS

        If ListeningPid(checkPort) > 0 Then
            WaitForListening = True
            Exit Function
        End If
    Next
End Function


Function ListeningPid(ByVal checkPort)
    Dim exec, line, re, matches

    ListeningPid = 0

    Set re = New RegExp
    re.IgnoreCase = True
    re.Global = False
    re.Pattern = "^\s*TCP\s+\S+:" & checkPort & "\s+\S+\s+LISTENING\s+(\d+)\s*$"

    On Error Resume Next
    Set exec = shell.Exec("cmd.exe /c netstat -ano -p tcp 2>nul")
    On Error GoTo 0

    If exec Is Nothing Then Exit Function

    Do While Not exec.StdOut.AtEndOfStream
        line = exec.StdOut.ReadLine()

        If re.Test(line) Then
            Set matches = re.Execute(line)
            ListeningPid = CLng(matches(0).SubMatches(0))
            Exit Function
        End If
    Loop
End Function


Function ReadState()
    Dim fileHandle, value

    ReadState = 0

    On Error Resume Next
    Set fileHandle = fso.OpenTextFile(stateFile, 1, False)
    value = Trim(fileHandle.ReadAll)
    fileHandle.Close
    On Error GoTo 0

    If IsNumeric(value) Then
        ReadState = CLng(value)
    End If
End Function


Sub WriteState(ByVal value)
    Dim fileHandle

    Set fileHandle = fso.CreateTextFile(stateFile, True)
    fileHandle.Write CStr(value)
    fileHandle.Close
End Sub


Sub DeleteFileIfExists(ByVal filePath)
    On Error Resume Next

    If fso.FileExists(filePath) Then
        fso.DeleteFile filePath, True
    End If

    On Error GoTo 0
End Sub
