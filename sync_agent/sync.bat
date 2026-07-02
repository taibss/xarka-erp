@echo off
cd /d C:\Users\JAYWANT CHAVAN\Desktop\Xarka test
echo. >> sync_log.txt
echo ===== %date% %time% ===== >> sync_log.txt
python sync_agent.py >> sync_log.txt 2>&1
echo ===== DONE ===== >> sync_log.txt
