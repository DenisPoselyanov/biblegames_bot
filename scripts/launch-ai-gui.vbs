' AI Launcher V3 — GUI без вікна CMD (pythonw з явним шляхом)
Option Explicit

Dim sh, fso, root, py, script, cmd
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
If LCase(fso.GetFileName(root)) = "scripts" Then
  root = fso.GetParentFolderName(root)
End If

script = root & "\scripts\launch-ai-gui.py"
If Not fso.FileExists(script) Then
  MsgBox "Не знайдено: " & script, vbCritical, "AI Launcher V3"
  WScript.Quit 1
End If

py = ResolvePythonw()
If py = "" Then
  MsgBox "Python (pythonw) не знайдено." & vbCrLf & vbCrLf & _
    "Встановіть Python 3.11+ з python.org" & vbCrLf & _
    "(Add to PATH) і перезапустіть.", vbCritical, "AI Launcher V3"
  WScript.Quit 1
End If

cmd = """" & py & """ """ & script & """"
sh.CurrentDirectory = root
sh.Run cmd, 0, False

Function ResolvePythonw()
  Dim env, ver, path, exec, line
  env = sh.ExpandEnvironmentStrings("%LocalAppData%")
  For Each ver In Array("313", "312", "311", "310")
    path = env & "\Programs\Python\Python" & ver & "\pythonw.exe"
    If fso.FileExists(path) Then
      ResolvePythonw = path
      Exit Function
    End If
  Next

  Set exec = sh.Exec("cmd /c where pythonw 2>nul")
  Do While exec.Status = 0
    WScript.Sleep 50
  Loop
  Do While Not exec.StdOut.AtEndOfStream
    line = Trim(exec.StdOut.ReadLine())
    If line <> "" Then
      If InStr(LCase(line), "windowsapps") = 0 And InStr(LCase(line), "pythoncore") = 0 Then
        If fso.FileExists(line) Then
          ResolvePythonw = line
          Exit Function
        End If
      End If
    End If
  Loop

  ResolvePythonw = ""
End Function
