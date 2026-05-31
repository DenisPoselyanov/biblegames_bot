' Подвійний клік — AI Launcher V3 без CMD
Dim fso, sh, root
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "wscript.exe //Nologo """ & root & "\scripts\launch-ai-gui.vbs""", 0, False
