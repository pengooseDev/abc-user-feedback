/* */
import React, { useCallback, useState } from 'react'
import cx from 'classnames'
import { useQuery, useQueryClient } from 'react-query'
import { useSnackbar } from 'baseui/snackbar'
import { Check, Delete } from 'baseui/icon'
import { KIND as ButtonKind } from 'baseui/button'
import {
  Modal,
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
  ROLE,
  SIZE
} from 'baseui/modal'
import { useTranslation } from 'next-i18next'

/* */
import styles from './styles.module.scss'
import MenuIcon from '~/assets/menu.svg'
import { UserLoader } from '~/components/Loader'
import { OWNER_KEY } from '@/constant'
import { deleteUserById, getUsers, roleUserBinding } from '~/service/user'
import { getRoles } from '~/service/role'
import { IRole, IUser, Permission } from '@/types'
import { useApp, useUser } from '~/hooks'
import { Avatar, DropDown, Tag } from '~/components'

const UserListContainer = () => {
  const queryClient = useQueryClient()
  const { enqueue } = useSnackbar()
  const { isLoading, isError, error, data } = useQuery<Array<IUser>>(
    'users',
    getUsers
  )

  const { data: roleData } = useQuery<Array<IRole>>('roles', getRoles)

  const { t } = useTranslation()

  const { config } = useApp()

  const [showDeleteUserModal, setShowDeleteUserModal] = useState<boolean>(false)
  const [deleteUser, setDeleteUser] = useState<IUser>(null)
  const { user: currentUser, hasPermission } = useUser()

  const renderAvatar = useCallback((user: IUser) => {
    return (
      <Avatar
        src={user?.profile?.avatarUrl}
        name={user?.profile?.nickname || user?.email}
      />
    )
  }, [])

  const handleRoleBinding = async (roleName: string, userId: string) => {
    try {
      await roleUserBinding({
        roleName,
        userId
      })

      queryClient.setQueryData('users', (users: Array<IUser>) =>
        users.map((user) => {
          if (user.id === userId) {
            if (user?.role) {
              user.role.name = roleName
            } else {
              user.role = {
                name: roleName
              }
            }
            return user
          }

          return user
        })
      )

      enqueue({
        message: 'Success role binding',
        startEnhancer: ({ size }) => <Check size={size} />
      })
    } catch (error) {
      enqueue({
        message: error.toString(),
        startEnhancer: ({ size }) => <Delete size={size} />
      })
    }
  }

  const handleCloseDeleteUserModal = () => {
    setShowDeleteUserModal(false)
    setDeleteUser(null)
  }

  const handleDeleteUser = async () => {
    if (deleteUser) {
      try {
        await deleteUserById(deleteUser.id)
        enqueue({
          message: 'Success delete user',
          startEnhancer: ({ size }) => <Check size={size} />
        })

        queryClient.setQueryData('users', (users: Array<IUser>) =>
          users.filter((user) => user.id !== deleteUser.id)
        )

        setShowDeleteUserModal(false)
        setDeleteUser(null)
      } catch (error) {
        enqueue({
          message: error.toString(),
          startEnhancer: ({ size }) => <Delete size={size} />
        })
      }
    }
  }

  const handleShowDeleteModal = (user: IUser) => {
    setDeleteUser(user)
    setShowDeleteUserModal(true)
  }

  const renderUserTag = useCallback((user: IUser) => {
    if (user && user?.role) {
      return (
        <Tag effect='dark' type='info' className={styles.tag}>
          {user.role.name}
        </Tag>
      )
    }
  }, [])

  const isUserDropDownVisible = useCallback(
    (user: IUser) => {
      if (user && currentUser) {
        if (currentUser.id === user.id) {
          return false
        }

        if (user.role > currentUser.role) {
          return false
        }

        return (
          hasPermission(Permission.DELETE_USER) ||
          hasPermission(Permission.MANAGE_ROLE)
        )
      }

      return false
    },
    [currentUser]
  )

  if (isLoading) {
    return (
      <div className={styles.container}>
        <UserLoader rows={10} />
      </div>
    )
  }

  if (isError) {
    return <span>Error: {error}</span>
  }

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {data.map((user: IUser) => (
          <div key={user.id} className={styles.user}>
            <div className={styles.user__left}>{renderAvatar(user)}</div>
            <div className={styles.user__right}>
              {config.app.useNickname && (
                <span className={styles.user__name}>
                  {user.profile?.nickname}
                </span>
              )}
              <span className={styles.user__email}>
                {config.app.useNickname ? `(${user?.email})` : user.email}
              </span>
              <div className={styles.user__tags}>
                {user.id === currentUser?.id && (
                  <Tag type='primary' className={styles.tag}>
                    me
                  </Tag>
                )}
                {renderUserTag(user)}
              </div>
            </div>
            {isUserDropDownVisible(user) && (
              <DropDown className={styles.user__menu} overlay={<MenuIcon />}>
                <div className={styles.dropdown}>
                  {hasPermission(Permission.MANAGE_ALL) && (
                    <div
                      className={styles.dropdown__item}
                      onClick={() => handleRoleBinding(OWNER_KEY, user.id)}
                    >
                      {t('action.user.role.binding', { role: OWNER_KEY })}
                    </div>
                  )}
                  {hasPermission(Permission.MANAGE_ROLE) &&
                    roleData
                      ?.filter(
                        (role) =>
                          role.name !== OWNER_KEY &&
                          role.name !== user?.role?.name
                      )
                      .map?.((role) => (
                        <div
                          key={role.name}
                          className={styles.dropdown__item}
                          onClick={() => handleRoleBinding(role.name, user.id)}
                        >
                          {t('action.user.role.binding', { role: role.name })}
                        </div>
                      ))}
                  {hasPermission(Permission.DELETE_USER) && (
                    <div
                      className={cx(
                        styles.dropdown__item,
                        styles.dropdown__item__warning
                      )}
                      onClick={() => handleShowDeleteModal(user)}
                    >
                      {t('action.member.delete')}
                    </div>
                  )}
                </div>
              </DropDown>
            )}
          </div>
        ))}
      </div>
      <Modal
        isOpen={showDeleteUserModal}
        onClose={handleCloseDeleteUserModal}
        size={SIZE.default}
        role={ROLE.dialog}
      >
        <ModalHeader>{t('confirm.delete.member')}</ModalHeader>
        <ModalBody>{deleteUser?.email}</ModalBody>
        <ModalFooter>
          <ModalButton
            onClick={handleCloseDeleteUserModal}
            kind={ButtonKind.tertiary}
          >
            {t('action.cancel')}
          </ModalButton>
          <ModalButton kind={ButtonKind.primary} onClick={handleDeleteUser}>
            {t('action.delete')}
          </ModalButton>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default UserListContainer
