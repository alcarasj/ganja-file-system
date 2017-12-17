#!/bin/bash

$FILE_SERVER ./ganja-file-server/start-file-server-unix.sh
$CLUSTER_SERVER ./ganja-cluster-server/start-cluster-server-unix.sh
$AUTH_SERVER ./ganja-auth-server/start-auth-server-unix.sh
$LOCK_SERVER ./ganja-lock-server/start-lock-server-unix.sh
$WEB_SERVER ./ganja-web-server/start-web-server-unix.sh

chmod u+x *.sh
. \"${FILE_SERVER}\" &
. \"${CLUSTER_SERVER}\" &
. \"${AUTH_SERVER}\" &
. \"${LOCK_SERVER}\" &
. \"${WEB_SERVER}\" &
wait
	

